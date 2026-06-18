// models/Worker.js

const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  designation: { type: String, trim: true },
  joinDate: { type: Date, required: true },
  employeeNo: { type: String, required: true, unique: true, trim: true },
  visaNumber: { type: String, trim: true },
  visaExpDate: { type: Date },
  laborCardNo: { type: String, trim: true },
  laborCardExpDate: { type: Date },
  emiratesIdNo: { type: String, trim: true },
  emiratesIdExpDate: { type: Date },
  passportNo: { type: String, trim: true },
  passportExpDate: { type: Date },
  mobNo: { type: String, trim: true },
  basicSalary: { type: Number, required: true, min: 0 },
  allowance: { type: Number, required: true, min: 0 },
  companyName: {
    type: String,
    enum: ['AL FAHEEM ELECTROMECHANICAL WORKS', 'DAF', 'Mazaya Al Madina'],
    default: 'AL FAHEEM ELECTROMECHANICAL WORKS'
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Useful indexes
workerSchema.index({ employeeNo: 1 });
workerSchema.index({ firstName: 1, lastName: 1 });
workerSchema.index({ visaExpDate: 1 });
workerSchema.index({ laborCardExpDate: 1 });

module.exports = mongoose.model('Worker', workerSchema);