const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/admin/login', authController.adminLogin);
router.post('/admin/register', authController.adminRegister);

router.post('/evOwner/login', authController.evOwnerLogin);
router.post('/evOwner/register', authController.evOwnerRegister);

router.post('/station-owner/login', authController.stationOwnerLogin);
router.post('/station-owner/register', authController.stationOwnerRegister);

router.post('/logout', authController.logout);
router.get('/me', authController.getMe);

module.exports = router;