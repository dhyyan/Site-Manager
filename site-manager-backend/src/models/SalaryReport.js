const mongoose = require('mongoose');

const SalaryReportSchema = new mongoose.Schema({
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    month: { type: String, required: true }, // YYYY-MM

    // Earnings
    basicSalary: { type: Number, default: 0 },
    allowance: { type: Number, default: 0 },
    totalSalary: { type: Number, default: 0 }, // Basic + Allow

    // Hours
    totalHours: { type: Number, default: 0 },
    normalOtHours: { type: Number, default: 0 },
    sundayOtHours: { type: Number, default: 0 },

    // OT Amounts
    otAedPerHrNormal: { type: Number, default: 0 },
    otAedPerHrSunday: { type: Number, default: 0 },
    totalOtAed: { type: Number, default: 0 },

    // Gross (Before Advance Deduction)
    currentEarnings: { type: Number, default: 0 },

    // Deductions
    absentDays: { type: Number, default: 0 },
    absentDeduction: { type: Number, default: 0 },
    advanceDeduction: { type: Number, default: 0 },
    otherDeduction: { type: Number, default: 0 }, // Medical/Petty Cash
    advancePending: { type: Number, default: 0 }, // Remaining advance AFTER this month's deduction
    deductedAdvances: [{
        advanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advance' },
        amount: Number,
        dateGiven: Date,
        notes: String
    }],

    // Net
    totalPayable: { type: Number, default: 0 }, // Net Payable for this month

    // Payments
    wpsAmount: { type: Number, default: 0 },
    cashAmount: { type: Number, default: 0 },

    // Result
    pendingAmount: { type: Number, default: 0 }, // Unpaid/CarryForward (if needed, or just remainder)

    status: { type: String, enum: ['draft', 'saved', 'paid'], default: 'saved' }
}, { timestamps: true });

// Ensure one report per worker per month
SalaryReportSchema.index({ worker: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('SalaryReport', SalaryReportSchema);
