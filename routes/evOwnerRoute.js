const express = require('express');
const router = express.Router();
const { registerEvOwner, sendOTP, verifyOTP, resetPassword } = require('../controllers/evOwnerController');
const authController = require('../controllers/authController');
const { getProfile, updateProfile, sendEmailOtp, verifyEmailOtp, saveAddress, changePassword, updateRecoveryPhone } = require('../controllers/profileController');

// Route to register a new EV owner
router.post('/register', registerEvOwner);
// Route to login an existing EV owner
// Use central auth controller for login so responses include tokens and a full user object
router.post('/login', authController.evOwnerLogin);

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

router.post('/reset-password', resetPassword);

// EV owner profile routes (no auth middleware applied here to match partner style)
router.get('/profile/:id', getProfile);
router.put('/profile/:id', updateProfile);
// Email change verification routes
router.post('/profile/:id/email/send-otp', sendEmailOtp);
router.post('/profile/:id/email/verify', verifyEmailOtp);
// Address form route
router.post('/profile/:id/address', saveAddress);
// Security routes
router.post('/profile/:id/change-password', changePassword);
router.post('/profile/:id/recovery-phone', updateRecoveryPhone);



module.exports = router;