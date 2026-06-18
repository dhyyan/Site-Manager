const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  clientName: { type: String, required: true, trim: true },
  siteRefName: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  lpoNo: { type: String, trim: true },
  lpoStatus: { type: String, default: 'Not Received', trim: true },
  jobRefNo: { type: String, trim: true },
  siteInChargeName: { type: String, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Index for fast queries
siteSchema.index({ clientName: 1 });
siteSchema.index({ siteRefName: 1 });

module.exports = mongoose.model('Site', siteSchema);