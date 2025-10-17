const express = require('express');
const router = express.Router();
const { registerEvOwner, loginEvOwner, sendOTP, verifyOTP, resetPassword } = require('../controllers/evOwnerController');
const { getProfile, updateProfile, sendEmailOtp, verifyEmailOtp } = require('../controllers/profileController');

// Route to register a new EV owner
router.post('/register', registerEvOwner);
// Route to login an existing EV owner
router.post('/login', loginEvOwner);

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

router.post('/reset-password', resetPassword);

// EV owner profile routes (no auth middleware applied here to match partner style)
router.get('/profile/:id', getProfile);
router.put('/profile/:id', updateProfile);
// Email change verification routes
router.post('/profile/:id/email/send-otp', sendEmailOtp);
router.post('/profile/:id/email/verify', verifyEmailOtp);



module.exports = router;