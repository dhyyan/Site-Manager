const mongoose = require('mongoose');

const dailyAttendanceSchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      required: true,
    },
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: true,
    },
    date: {
      type: Date,
      required: true,
      // YYYY-MM-DD (UTC midnight)
    },
    // 0 = absent, 0.5 = half-day, 1 = full day
    status: { type: Number, required: true, min: 0, max: 2 },
    workingHours: { type: Number, default: 0, min: 0 }, // normal hours (max 8)
    otHours: { type: Number, default: 0, min: 0 },
    isRamzan: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Unique per worker-site-date
dailyAttendanceSchema.index({ worker: 1, site: 1, date: 1 }, { unique: true });
// Fast month aggregation
dailyAttendanceSchema.index({ date: 1 });

module.exports = mongoose.model('DailyAttendance', dailyAttendanceSchema);