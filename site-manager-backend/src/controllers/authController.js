const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpEmail } = require('../utils/mailer'); 

// ──────────────────────────────────────
// 1. Request OTP
const requestOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ msg: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    
    // Always respond the same way (security: don't reveal if email exists)
    if (!user) {
      return res.json({ msg: 'If email exists, OTP sent.' });
    }

    // Rate limiting: Max 1 OTP per 45 seconds (adjust as needed)
    const OTP_COOLDOWN = 45 * 1000; // 45 seconds
    const now = Date.now();

    if (user.lastOtpSentAt && now - user.lastOtpSentAt < OTP_COOLDOWN) {
      const waitTime = Math.ceil((OTP_COOLDOWN - (now - user.lastOtpSentAt)) / 1000);
      return res.status(429).json({
        msg: `Too many requests. Please wait ${waitTime} seconds before requesting again.`,
      });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    user.lastOtpSentAt = Date.now(); // Update timestamp

    await user.save();
    await sendOtpEmail(email, otp);

    res.json({ msg: 'OTP sent to email' });
  } catch (err) {
    console.error('OTP Request Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// ──────────────────────────────────────
// 2. Verify OTP + Reset Password
const verifyOtpAndReset = async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ msg: 'Passwords do not match' });
  }

  try {
const user = await User.findOne({
  email,
  resetOtp: otp.trim(), 
  resetOtpExpires: { $gt: Date.now() },
});

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    user.password = password;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.json({ msg: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// ──────────────────────────────────────
// 1. FORGOT PASSWORD – send email
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Don’t reveal if email exists
      return res.json({ msg: 'If the email exists, a reset link has been sent.' });
    }

    // Generate 32‑byte token & 15‑min expiry
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    await sendResetEmail(email, token);
    res.json({ msg: 'If the email exists, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// ──────────────────────────────────────
// 2. RESET PASSWORD – verify token & update
const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ msg: 'Invalid or expired token' });

    user.password = password;               // pre‑save hook hashes it
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// ------------------------------------------------------------------
// Helper: Access token (1 h)
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// Helper: Refresh token (random 64‑byte hex)
const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

// ------------------------------------------------------------------
// Store a new refresh token for a user
const storeRefreshToken = async (userId, refreshToken) => {
  await User.findByIdAndUpdate(
    userId,
    { $push: { refreshTokens: { token: refreshToken } } },
    { new: true }
  );
};

// ------------------------------------------------------------------
// Verify a refresh token and return the userId (or null)
const verifyRefreshToken = async (refreshToken) => {
  const user = await User.findOne({ 'refreshTokens.token': refreshToken });
  if (!user) return null;

  // Clean up tokens older than 7 days
  await User.findByIdAndUpdate(user._id, {
    $pull: {
      refreshTokens: {
        createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    },
  });

  return user._id;
};

// ------------------------------------------------------------------
// LOGIN
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await storeRefreshToken(user._id, refreshToken);

    res.json({ accessToken });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ------------------------------------------------------------------
// REFRESH TOKEN ENDPOINT
const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(403).json({ msg: 'No token' });

  const userId = await verifyRefreshToken(refreshToken);
  if (!userId) return res.status(403).json({ msg: 'Invalid token' });

  const accessToken = generateAccessToken(userId);
  res.json({ accessToken });
};

module.exports = {
  login,
  refreshToken,
  forgotPassword,
  resetPassword,  
  requestOtp,
  verifyOtpAndReset
};