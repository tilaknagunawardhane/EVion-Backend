const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middlewares/authMiddleware');

const { requestEmailUpdate, verifyEmailOtp, resendEmailOtp } = require('../controllers/profileController');

// Get profile
router.get('/:userType/:id', authMiddleware, profileController.getProfile);
// Update profile
router.put('/:userType/:id', authMiddleware, profileController.updateProfile);
// Delete account
router.delete('/:userType/:id', authMiddleware, profileController.deleteAccount);
// Change password
router.post('/:userType/:id/change-password', authMiddleware, profileController.changePassword);
// Request email update (send OTP)
router.post('/:userType/:id/request-email-update', authMiddleware, requestEmailUpdate);
// Verify OTP
router.post('/:userType/:id/verify-email-otp', authMiddleware, verifyEmailOtp);
// Resend OTP
router.post('/:userType/:id/resend-email-otp', authMiddleware, resendEmailOtp);

module.exports = router;
