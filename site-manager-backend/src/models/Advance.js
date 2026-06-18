// models/Advance.js
const mongoose = require('mongoose');

const advanceSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  amount: { type: Number, required: true, min: 0 },
  dateGiven: { type: Date, required: true },
  notes: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'deducted'], default: 'pending' },
  deductedAt: { type: Date },
  deductedInMonth: { type: String }, // e.g., "2025-12"
}, { timestamps: true });

advanceSchema.index({ worker: 1, dateGiven: -1 });
advanceSchema.index({ status: 1 });
advanceSchema.index({ deductedInMonth: 1 });

module.exports = mongoose.model('Advance', advanceSchema);