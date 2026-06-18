const mongoose = require('mongoose');

/**
 * Calculate worker salary stats including OT, absences, and advance deductions (Greedy Fit).
 * @param {Object} worker - Worker document
 * @param {Object} att - Attendance stats { presentDays, totalHours, normalOtHours, sundayOtHours }
 * @param {Array} pendingAdvances - List of pending advance documents for this worker
 * @param {Number} daysInMonth - Total days in the month
 * @returns {Object} Calculated stats
 */
const calculateWorkerSalary = (worker, att, pendingAdvances, daysInMonth, sundaysInMonth = 0) => {
    const normalHoursPerMonth = 208; // Keep for reference if needed
    const totalSalary = worker.basicSalary + worker.allowance;
    
    // New Client Requirement: OT calculated on Basic Pay / daysInMonth / 8 hours
    const otHourlyRate = worker.basicSalary / daysInMonth / 8;
    
    const perDayRate = totalSalary / daysInMonth;

    // OT Calculation
    const otNormal = att.normalOtHours * otHourlyRate;
    const otSunday = att.sundayOtHours * (otHourlyRate * 1.5);
    const totalOtAed = otNormal + otSunday;

    // Absence Calculation
    const expectedWorkdays = daysInMonth - sundaysInMonth;
    const absentDays = Math.max(0, expectedWorkdays - att.presentDays);
    const absentDeduction = absentDays * perDayRate;

    // Gross Earnings (Before Advances)
    // Ensure we don't go below zero
    const grossEarnings = Math.max(0, totalSalary + totalOtAed - absentDeduction);

    // Advance Deduction (Greedy Fit)
    // Sort advances by date (oldest first) to deduct in order
    const sortedAdvances = [...pendingAdvances].sort((a, b) => new Date(a.dateGiven) - new Date(b.dateGiven));

    let remainingSalary = grossEarnings;
    let totalAdvanceDeduction = 0;
    const deductedAdvances = [];

    for (const advance of sortedAdvances) {
        if (remainingSalary >= advance.amount) {
            // Deduct this advance
            remainingSalary -= advance.amount;
            totalAdvanceDeduction += advance.amount;
            deductedAdvances.push({
                advanceId: advance._id,
                amount: advance.amount,
                dateGiven: advance.dateGiven,
                notes: advance.notes
            });
        } else {
            // Cannot deduct fully, skip (defer to next month)
            // If implementing Partial, logic would go here.
            // Current Logic: Greedy fit of WHOLE advances only.
        }
    }

    // Total Advance Pending (Before Deduction)
    const totalPendingAdvance = pendingAdvances.reduce((sum, a) => sum + a.amount, 0);
    const advancePending = totalPendingAdvance - totalAdvanceDeduction;

    const netPayable = grossEarnings - totalAdvanceDeduction;

    return {
        basicSalary: worker.basicSalary,
        allowance: worker.allowance,
        totalSalary,
        totalHours: att.totalHours,
        normalOtHours: att.normalOtHours,
        sundayOtHours: att.sundayOtHours,
        otAedPerHrNormal: otHourlyRate,
        otAedPerHrSunday: otHourlyRate * 1.5,
        totalOtAed,
        absentDays,
        absentDeduction,
        currentEarnings: grossEarnings, // Gross Earnings (Work + OT - Absent)
        advanceDeduction: totalAdvanceDeduction,
        deductedAdvances, // List of detailed deductions
        advancePending, // Remaining Balance
        totalPayable: netPayable
    };
};

module.exports = { calculateWorkerSalary };
