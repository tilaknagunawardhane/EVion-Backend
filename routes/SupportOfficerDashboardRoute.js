const express = require('express');
const router = express.Router();

const { 
    getSupportOfficerDashboardStats, 

} = require('../controllers/supportOfficerDashboardController');

const authMiddleware = require('../middlewares/authMiddleware');

router.get('/stats', getSupportOfficerDashboardStats);

module.exports = router;