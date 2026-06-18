const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  refreshTokens: [
    { token: String, createdAt: { type: Date, default: Date.now } },
  ],
  // Password reset token (for link-based flow)
  resetPasswordToken: String,
  resetPasswordExpires: Date,

  // OTP-based reset fields
  resetOtp: String,
  resetOtpExpires: Date,

  // NEW: Prevent OTP spam
  lastOtpSentAt: { type: Date }, // Track when last OTP was sent
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);