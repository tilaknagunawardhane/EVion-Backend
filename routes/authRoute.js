const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/admin/login', authController.adminLogin);
router.post('/admin/register', authController.adminRegister);

router.post('/support-officer/login', authController.supportOfficerLogin);
router.post('/evOwner/login', authController.evOwnerLogin);
router.post('/evOwner/register', authController.evOwnerRegister);

router.post('/station-owner/login', authController.stationOwnerLogin);
router.post('/station-owner/register', authController.uploadImage ,authController.stationOwnerRegister);

router.post('/logout', authController.logout);
router.get('/me', authMiddleware() ,authController.getMe);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;