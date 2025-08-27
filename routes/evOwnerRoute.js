const express = require('express');
const router = express.Router();
const { registerEvOwner, loginEvOwner, sendOTP, verifyOTP, resetPassword } = require('../controllers/evOwnerController');

// Route to register a new EV owner
router.post('/register', registerEvOwner);
// Route to login an existing EV owner
router.post('/login', loginEvOwner);

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

router.post('/reset-password', resetPassword);



module.exports = router;