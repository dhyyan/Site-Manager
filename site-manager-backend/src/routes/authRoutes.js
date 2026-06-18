const express = require('express');
const { signup, login,refreshToken,forgotPassword, resetPassword,requestOtp,verifyOtpAndReset } = require('../controllers/authController');
const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/request-otp', requestOtp);
router.post('/reset-password-otp', verifyOtpAndReset);

module.exports = router;