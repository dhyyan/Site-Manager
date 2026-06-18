// @ts-nocheck
const DailyAttendance = require('../models/Attendance');
const Site = require('../models/Site');



const upsertDaily = async (req, res) => {
  try {
    const { worker, site, date, status, workingHours, otHours, isRamzan } = req.body;
    
    // Intents for THIS site
    const inputNormal = Number(workingHours) || 0;
    const inputOt = Number(otHours) || 0;
    const isRamzanDay = isRamzan === true || isRamzan === 'true';
    
    const isoDate = new Date(date);
    isoDate.setUTCHours(0, 0, 0, 0);

    // Sum currently saved normal hours for OTHER sites today
    const otherRecords = await DailyAttendance.find({
      worker,
      date: isoDate,
      site: { $ne: site } // exclude the site being edited
    });
    
    const otherNormalHours = otherRecords.reduce((sum, r) => sum + r.workingHours, 0);
    
    let newNormal = 0;
    let newOt = 0;
    
    // Enforcement: Maximum 8 normal hours per day across all sites (6 for Ramzan)
    const maxNormal = isRamzanDay ? 6 : 8;
    const remainingNormal = Math.max(0, maxNormal - otherNormalHours);
    
    if (inputNormal <= remainingNormal) {
      newNormal = inputNormal;
      newOt = inputOt;
    } else {
      newNormal = remainingNormal;
      // Spillover extra intended normal hours into OT + any explicit OT
      newOt = inputOt + (inputNormal - remainingNormal);
    }

    const record = await DailyAttendance.findOneAndUpdate(
      { worker, site, date: isoDate },
      { status, workingHours: newNormal, otHours: newOt, isRamzan: isRamzanDay },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .populate('worker', 'firstName lastName employeeNo')
      .populate('site', 'siteRefName');

    res.status(record.isNew ? 201 : 200).json(record);
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: err.message });
  }
};

/* ---------- GET BY DATE ---------- */
const getByDate = async (req, res) => {
    try {
      const { date } = req.params;
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 50;

      if (page < 1) page = 1;
      if (limit < 1) limit = 50;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ msg: 'Invalid date format. Use YYYY-MM-DD' });
      }

      const isoDate = new Date(date + 'T00:00:00.000Z');
      if (isNaN(isoDate.getTime())) {
        return res.status(400).json({ msg: 'Invalid date' });
      }

      const skip = (page - 1) * limit;

      const rawRecords = await DailyAttendance.find({ date: isoDate })
        .populate('worker', 'firstName lastName employeeNo')
        .populate('site', 'siteRefName')
        .select('worker site status workingHours otHours isRamzan')
        .sort({ createdAt: -1 })
        .lean();

      // Group by worker for unified daily view
      const groupedMap = rawRecords.reduce((acc, r) => {
        if (!r.worker) return acc;
        const wid = r.worker._id.toString();
        if (!acc[wid]) {
          acc[wid] = {
            _id: r._id, // proxy ID
            worker: r.worker,
            status: r.status,
            workingHours: 0,
            otHours: 0,
            details: []
          };
        }
        
        acc[wid].workingHours += r.workingHours;
        acc[wid].otHours += r.otHours;
        
        if (r.status > acc[wid].status) {
          acc[wid].status = r.status;
        }
        
        if (r.site && r.site.siteRefName) {
           acc[wid].details.push({
             _id: r._id,
             site: { ...r.site }, // pass site full object in case needed
             siteName: r.site.siteRefName,
             workingHours: r.workingHours,
             otHours: r.otHours,
             isRamzan: r.isRamzan
           });
        }
        return acc;
      }, {});

      const grouped = Object.values(groupedMap);

      const total = grouped.length;
      
      const paginatedRecords = grouped.slice(skip, skip + limit);

      res.json({
        records: paginatedRecords,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
          limit
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Server error' });
    }
};

/* ---------- GET RANGE ---------- */
const getRange = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ msg: 'start & end required' });

    const records = await DailyAttendance.find({
      date: { $gte: new Date(start), $lte: new Date(end) },
    })
      .populate('worker', 'firstName lastName employeeNo')
      .populate('site', 'siteRefName')
      .select('worker date status workingHours otHours site isRamzan');

    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

const getMonthlyAttendance = async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ msg: "year & month required" });

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const records = await DailyAttendance.find({
      date: { $gte: start, $lte: end }
    })
      .populate('worker', 'firstName lastName employeeNo')
      .populate('site', 'siteRefName')
      .select('date status workingHours otHours worker site isRamzan')
      .sort({ date: 1, "worker.employeeNo": 1 })
      .lean();

    res.json({ records, total: records.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

/* ---------- SITE ALLOCATION REPORT ---------- */
const getSiteAllocationReport = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ msg: 'start & end required' });

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setUTCHours(23, 59, 59, 999);

    const agg = await DailyAttendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: { site: "$site", worker: "$worker" },
          daysWorked: {
            $sum: {
              $cond: [
                { $in: ["$status", [1, 2]] }, 1,
                { $cond: [{ $eq: ["$status", 0.5] }, 0.5, 0] }
              ]
            }
          },
          // If workingHours was saved as 0 (old records without hours),
          // fall back to deriving from status: full-day=8hrs, half-day=4hrs
          totalHours: {
            $sum: {
              $cond: [
                { $gt: ["$workingHours", 0] },
                "$workingHours",
                {
                  $cond: [
                    { $in: ["$status", [1, 2]] }, 8,
                    { $cond: [{ $eq: ["$status", 0.5] }, 4, 0] }
                  ]
                }
              ]
            }
          },
          totalOtHours: { $sum: "$otHours" }
        }
      },
      {
        $lookup: {
          from: "workers",
          localField: "_id.worker",
          foreignField: "_id",
          as: "workerInfo"
        }
      },
      {
        $unwind: "$workerInfo"
      },
      {
        $group: {
          _id: "$_id.site",
          workers: {
            $push: {
              firstName: "$workerInfo.firstName",
              lastName: "$workerInfo.lastName",
              employeeNo: "$workerInfo.employeeNo",
              daysWorked: "$daysWorked",
              totalHours: "$totalHours",
              totalOtHours: "$totalOtHours"
            }
          }
        }
      }
    ]);

    const allSites = await Site.find({ isActive: { $ne: false } }).select('siteRefName').lean();

    const report = allSites.map(site => {
      const siteAgg = agg.find(a => a._id && a._id.toString() === site._id.toString());
      return {
        siteId: site._id,
        siteName: site.siteRefName,
        workers: siteAgg ? siteAgg.workers : []
      };
    });

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

/* ---------- DELETE RECORD ---------- */
const deleteDaily = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await DailyAttendance.findByIdAndDelete(id);
    if (!record) {
      return res.status(404).json({ msg: 'Record not found' });
    }
    res.status(200).json({ msg: 'Record deleted successfully' });
  } catch (err) {
    console.error('Error deleting daily record:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = { upsertDaily, getByDate, getRange, getMonthlyAttendance, getSiteAllocationReport, deleteDaily };
