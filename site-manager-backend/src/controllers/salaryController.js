
// controllers/salaryController.js
const mongoose = require('mongoose');
const DailyAttendance = require('../models/Attendance');
const Advance = require('../models/Advance');
const Worker = require('../models/Worker');
const Wps = require('../models/Wps'); // Keeping for legacy/migration if needed, or we can drop usage. Keeping logical ref.
const SalaryReport = require('../models/SalaryReport');
const { calculateWorkerSalary } = require('../utils/salaryCalculator');

const getPreviousMonth = (currentMonth) => {
  const [year, mon] = currentMonth.split('-').map(Number);
  const date = new Date(year, mon - 2, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

// Helper to count Sundays in a month using UTC
const getSundaysInMonth = (year, mon) => {
  let sundays = 0;
  const numDays = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  console.log("numDays in a month", numDays)
  for (let day = 1; day <= numDays; day++) {
    const d = new Date(Date.UTC(year, mon - 1, day));
    if (d.getUTCDay() === 0) { // Sunday is 0
      sundays++;
    }
  }
  return sundays;
};

// Helper for single worker live calc (used in save)
const getWorkerSalaryStats = async (workerId, month) => {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
  const daysInMonth = end.getUTCDate();
  const sundaysInMonth = getSundaysInMonth(year, mon);

  // Attendance
  const attendanceAgg = await DailyAttendance.aggregate([
    { $match: { worker: new mongoose.Types.ObjectId(workerId), date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { worker: "$worker", date: "$date" },
        dayWorkingHours: { $sum: "$workingHours" },
        dayOtHours: { $sum: "$otHours" },
        dayMaxStatus: { $max: "$status" }
      }
    },
    {
      $group: {
        _id: "$_id.worker",
        presentDays: {
          $sum: {
            $cond: [
              { $eq: [{ $dayOfWeek: "$_id.date" }, 1] }, // If Sunday (1)
              0, // Exclude Sundays from weekday presentDays
              {
                $cond: [
                  { $in: ["$dayMaxStatus", ["present", 1, 2]] },
                  1,
                  { $cond: [{ $eq: ["$dayMaxStatus", 0.5] }, 0.5, 0] }
                ]
              }
            ]
          }
        },
        totalHours: { $sum: "$dayWorkingHours" },
        normalOtHours: { $sum: { $cond: [{ $ne: [{ $dayOfWeek: "$_id.date" }, 1] }, "$dayOtHours", 0] } },
        sundayOtHours: { $sum: { $cond: [{ $eq: [{ $dayOfWeek: "$_id.date" }, 1] }, "$dayOtHours", 0] } }
      }
    }
  ]);

  const att = attendanceAgg[0] || { presentDays: 0, totalHours: 0, normalOtHours: 0, sundayOtHours: 0 };

  // Advances - Look for ALL Pending, or those deducted in THIS key month (for re-runs)
  // We want to "simulate" the state before this month was finalized, so we include:
  // 1. Status = Pending (Date <= MonthEnd)
  // 2. Status = Deducted BUT DeductedInMonth = CurrentMonth (in case we are re-saving)
  const advances = await Advance.find({
    worker: workerId,
    dateGiven: { $lte: end },
    $or: [
      { status: 'pending' },
      { status: 'deducted', deductedInMonth: month }
    ]
  }).lean();

  // Worker Details
  const worker = await Worker.findById(workerId).lean();
  if (!worker) throw new Error('Worker not found');

  return {
    worker,
    daysInMonth,
    stats: calculateWorkerSalary(worker, att, advances, daysInMonth, sundaysInMonth)
  };
};

const getSalaryReport = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ msg: 'Valid month required (YYYY-MM)' });
    }

    const [year, mon] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
    const daysInMonth = end.getUTCDate();
    const sundaysInMonth = getSundaysInMonth(year, mon);
    const expectedWorkdays = daysInMonth - sundaysInMonth;

    // 1. Always Calculate Live Attendance Stats
    const attendanceAgg = await DailyAttendance.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { worker: "$worker", date: "$date" },
          dayWorkingHours: { $sum: "$workingHours" },
          dayOtHours: { $sum: "$otHours" },
          dayMaxStatus: { $max: "$status" }
        }
      },
      {
        $group: {
          _id: "$_id.worker",
          presentDays: {
            $sum: {
              $cond: [
                { $eq: [{ $dayOfWeek: "$_id.date" }, 1] }, // If Sunday (1)
                0, // Exclude Sundays from weekday presentDays
                {
                  $cond: [
                    { $in: ["$dayMaxStatus", ["present", 1, 2]] },
                    1,
                    { $cond: [{ $eq: ["$dayMaxStatus", 0.5] }, 0.5, 0] }
                  ]
                }
              ]
            }
          },
          totalHours: { $sum: "$dayWorkingHours" },
          normalOtHours: { $sum: { $cond: [{ $ne: [{ $dayOfWeek: "$_id.date" }, 1] }, "$dayOtHours", 0] } },
          sundayOtHours: { $sum: { $cond: [{ $eq: [{ $dayOfWeek: "$_id.date" }, 1] }, "$dayOtHours", 0] } }
        }
      }
    ]);

    // 2. Fetch Payments (Saved Report for CURRENT month)
    const currentReports = await SalaryReport.find({ month }).lean();
    const savedReportsMap = {}; // Map workerId -> entire saved report
    currentReports.forEach(r => {
      savedReportsMap[r.worker.toString()] = r;
    });

    // 3. Fetch Previous Pending and WPS (Saved Report for PREVIOUS month)
    const prevMonthStr = getPreviousMonth(month);
    const prevReports = await SalaryReport.find({ month: prevMonthStr }).lean();
    const prevPendingMap = {};
    const prevWpsMap = {};
    prevReports.forEach(r => {
      prevPendingMap[r.worker.toString()] = r.pendingAmount || 0;
      prevWpsMap[r.worker.toString()] = r.wpsAmount || 0;
    });

    // 4. Advances & Workers
    // Fetch ALL pending advances up to end of month, OR deducted in this month
    const workers = await Worker.find({}).lean();
    const allAdvances = await Advance.find({
      dateGiven: { $lte: end },
      $or: [
        { status: 'pending' },
        { status: 'deducted', deductedInMonth: month }
      ]
    }).lean();

    const advancesByWorker = {};
    allAdvances.forEach(adv => {
      const wid = adv.worker.toString();
      if (!advancesByWorker[wid]) advancesByWorker[wid] = [];
      advancesByWorker[wid].push(adv);
    });

    // 5. Build Records
    const normalHoursPerMonth = 208;

    const records = workers.map(worker => {
      const wid = worker._id.toString();

      // Live Attendance
      const att = attendanceAgg.find(a => a._id.toString() === wid) || {
        presentDays: 0, totalHours: 0, normalOtHours: 0, sundayOtHours: 0
      };

      const totalSalary = worker.basicSalary + worker.allowance;
      const otHourlyRate = worker.basicSalary / daysInMonth / 8;
      const perDayRate = totalSalary / daysInMonth;

      const otNormal = att.normalOtHours * otHourlyRate;
      const otSunday = att.sundayOtHours * (otHourlyRate * 1.5);
      const totalOtAed = otNormal + otSunday;

      const absentDays = Math.max(0, expectedWorkdays - att.presentDays);
      const absentDeduction = absentDays * perDayRate;

      const workerAdvances = advancesByWorker[wid] || [];

      // Calculate using shared utility
      const stats = calculateWorkerSalary(worker, att, workerAdvances, daysInMonth, sundaysInMonth);

      // Live Net Earnings
      // const netEarnings = stats.totalPayable; // Removed to avoid redeclaration, handled below
      const totalAdvance = stats.advanceDeduction;
      const deductedAdvances = stats.deductedAdvances;

      // Merge with Persisted Data
      const prevPending = prevPendingMap[wid] || 0;
      const savedReport = savedReportsMap[wid];

      // If we have a saved report, we MUST use its deductions if they were effectively "frozen" or "edited".
      // However, the requirement "advance deducted should be manually edited" implies we prefer the saved value if present.
      // But we also want "live" updates for attendance.
      // Strategy: 
      // 1. Advance Deduction: Use Saved if exists (manual override), else Calculated. 
      //    (Actually, if we save, we save the Calculated one too if not overridden. So 'saved' is usually safer if we want stability, 
      //    BUT if attendance changes, we might want to re-calc? 
      //    The prompt says "manually edited INSTEAD OF checking salary is available".
      //    So if I edit it, it stays. 
      //    Let's use the Saved value for Advance if the report is 'saved'.
      // 2. Other Deduction: Use Saved (default 0).

      let finalAdvance = stats.advanceDeduction;
      let finalOther = 0;
      let savedWps = 0;
      let savedCash = 0;

      if (savedReport) {
        finalAdvance = savedReport.advanceDeduction;
        finalOther = savedReport.otherDeduction || 0;
        savedWps = savedReport.wpsAmount || 0;
        savedCash = savedReport.cashAmount || 0;
      } else {
        // Carry forward the previous month's WPS amount as the default
        savedWps = prevWpsMap[wid] || 0;
      }

      // Calculate Total Debt and Real Pending
      const totalDebt = (stats.advancePending || 0) + stats.advanceDeduction;
      const realAdvancePending = Math.max(0, totalDebt - finalAdvance);

      // Recalculate Net/Due
      // Net = Gross(CurrentEarnings) - Advance - Other(Deduction)
      const netEarnings = stats.currentEarnings - finalAdvance - finalOther;

      const totalDue = netEarnings + prevPending;
      const totalPaid = savedWps + savedCash;
      const pending = totalDue - totalPaid; // Allow negative

      return {
        _id: worker._id,
        givenName: worker.firstName,
        surname: worker.lastName,
        employNo: worker.employeeNo,
        designation: worker.designation,
        companyName: worker.companyName,

        basicSalary: +worker.basicSalary.toFixed(2),
        allowance: +worker.allowance.toFixed(2),
        totalSalary: +totalSalary.toFixed(2),

        totalHrInclOT: Math.round(att.totalHours + att.normalOtHours + att.sundayOtHours),
        normalHrExcOT: +att.totalHours.toFixed(2),
        normalOtHr: Math.round(att.normalOtHours),
        sundayOtHr: Math.round(att.sundayOtHours),

        absent: Math.max(0, absentDays),
        otAedPerHrNormal: +otHourlyRate.toFixed(2),
        otAedPerHrSunday: +(otHourlyRate * 1.5).toFixed(2),
        totalOtAed: +totalOtAed.toFixed(2),
        perDayAed: +perDayRate.toFixed(2),

        absentDeduction: +absentDeduction.toFixed(2),
        absentDeduction: +absentDeduction.toFixed(2),
        advance: +finalAdvance.toFixed(2),
        otherDeduction: +finalOther.toFixed(2),
        advancePending: +realAdvancePending.toFixed(2), // Updated logic
        deductedAdvances: deductedAdvances, // Pass detailed list

        // Hybrid Fields
        prevPending: +prevPending.toFixed(2),
        currentEarnings: +(stats.currentEarnings || 0).toFixed(2),
        netPayable: +netEarnings.toFixed(2), // Just alias for clarity, front end uses totalSalaryPayable mainly

        // Payments from Saved Report
        wps: savedWps,
        cash: savedCash,

        totalSalaryPayable: +totalDue.toFixed(2),
        pending: +pending.toFixed(2),

        isSaved: !!savedReport // Just a flag if needed
      };
    });

    const totals = {
      totalBasicSalary: +records.reduce((a, b) => a + b.basicSalary, 0).toFixed(2),
      totalAllowance: +records.reduce((a, b) => a + b.allowance, 0).toFixed(2),
      totalSalary: +records.reduce((a, b) => a + b.totalSalary, 0).toFixed(2),
      totalOtAed: +records.reduce((a, b) => a + b.totalOtAed, 0).toFixed(2),
      totalCurrentEarnings: +records.reduce((a, b) => a + (b.currentEarnings || 0), 0).toFixed(2),
      totalAbsentDeduction: +records.reduce((a, b) => a + b.absentDeduction, 0).toFixed(2),
      totalAdvanceDeduction: +records.reduce((a, b) => a + b.advance, 0).toFixed(2),
      totalOtherDeduction: +records.reduce((a, b) => a + b.otherDeduction, 0).toFixed(2),
      totalAdvancePending: +records.reduce((a, b) => a + (b.advancePending || 0), 0).toFixed(2),
      totalPrevPending: +records.reduce((a, b) => a + b.prevPending, 0).toFixed(2),
      totalWps: +records.reduce((a, b) => a + b.wps, 0).toFixed(2),
      totalCash: +records.reduce((a, b) => a + b.cash, 0).toFixed(2),
      totalPending: +records.reduce((a, b) => a + b.pending, 0).toFixed(2),
      totalPayroll: +records.reduce((a, b) => a + b.totalSalaryPayable, 0).toFixed(2)
    };

    res.json({ month, records, totals });
  } catch (err) {
    console.error("Salary Report Error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

const saveSalary = async (req, res) => {
  try {
    const { month, workerId, wpsAmount, cashAmount, advanceDeduction, otherDeduction } = req.body;

    if (!month || !workerId) return res.status(400).json({ msg: 'Missing required fields' });

    // 1. Calculate Live Stats for this worker (Source of Truth)
    const { stats } = await getWorkerSalaryStats(workerId, month);

    // 2. Prepare Data
    const wps = Number(wpsAmount) || 0;
    const cash = Number(cashAmount) || 0;
    const other = Number(otherDeduction) || 0;
    let finalAdvanceDeduction = stats.advanceDeduction;

    // Manual Advance Deduction Override
    if (advanceDeduction !== undefined && advanceDeduction !== null) {
      const manualAdvance = Number(advanceDeduction);

      // 1. Validation: Advance Deducted cannot exceed Current Earnings (Gross)
      //    "only allow advance to be deducted if earned amount is above 0 value and it contains more than advance deducted value amount"
      //    We can return error 00 or clamp it? "allow" implies validation failure.
      if (manualAdvance > stats.currentEarnings) {
        return res.status(400).json({ msg: `Advance deduction (${manualAdvance}) cannot exceed current earnings (${stats.currentEarnings})` });
      }

      finalAdvanceDeduction = manualAdvance;
    }

    // Fetch Prev Pending for this worker
    const prevMonthStr = getPreviousMonth(month);
    const prevReport = await SalaryReport.findOne({ worker: workerId, month: prevMonthStr }).lean();
    const prevPending = prevReport ? prevReport.pendingAmount : 0;

    // Recalculate Net based on possible manual Advance / Other Deduction
    // Net = Gross - Advance - Other
    const net = stats.currentEarnings - finalAdvanceDeduction - other;
    const totalDue = net + prevPending;

    // Update Advance Pending Logic
    // Total Debt = (Pending + Calculated Deduction)
    const totalDebt = (stats.advancePending || 0) + stats.advanceDeduction;
    const realAdvancePending = Math.max(0, totalDebt - finalAdvanceDeduction);

    // Allow negative pending (User Request: "pending c/f column can be negative amount")
    const pending = totalDue - (wps + cash);

    const reportData = {
      worker: workerId,
      month,

      basicSalary: stats.basicSalary,
      allowance: stats.allowance,
      totalSalary: stats.totalSalary,

      totalHours: stats.totalHours,
      normalOtHours: stats.normalOtHours,
      sundayOtHours: stats.sundayOtHours,

      otAedPerHrNormal: stats.otAedPerHrNormal,
      otAedPerHrSunday: stats.otAedPerHrSunday,
      totalOtAed: stats.totalOtAed,

      // ADDED FIELD
      currentEarnings: stats.currentEarnings,

      absentDays: stats.absentDays,
      absentDeduction: stats.absentDeduction,
      advanceDeduction: finalAdvanceDeduction,
      otherDeduction: other,
      advancePending: realAdvancePending, // Updated Logic
      deductedAdvances: stats.deductedAdvances,

      totalPayable: net,
      wpsAmount: wps,
      cashAmount: cash,
      pendingAmount: pending,

      status: 'saved'
    };

    // 3. Upsert Salary Report
    const doc = await SalaryReport.findOneAndUpdate(
      { worker: workerId, month },
      reportData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 4. Update Advance Statuses
    // First, revert any previous deductions for this month (if re-saving)
    // We set ANY advance deducted in this month back to pending, then re-apply based on current calculation
    // This handles the case where salary DECREASED and fewer advances can be deducted.
    await Advance.updateMany(
      { worker: workerId, deductedInMonth: month },
      { $set: { status: 'pending', deductedInMonth: null, deductedAt: null } }
    );

    // Now mark the newly deducted ones as deducted
    if (stats.deductedAdvances && stats.deductedAdvances.length > 0) {
      const deductedIds = stats.deductedAdvances.map(a => a.advanceId);
      await Advance.updateMany(
        { _id: { $in: deductedIds } },
        {
          $set: {
            status: 'deducted',
            deductedInMonth: month,
            deductedAt: new Date()
          }
        }
      );
    }

    res.json({ msg: 'Salary Saved', report: doc });
  } catch (err) {
    console.error('saveSalary error', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = { getSalaryReport, saveSalary };

