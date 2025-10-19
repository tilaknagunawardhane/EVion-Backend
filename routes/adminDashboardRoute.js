const express = require('express');
const router = express.Router();

const { 
    getAdminDashboardStats, 

} = require('../controllers/adminDashboardController');

const authMiddleware = require('../middlewares/authMiddleware');

router.get('/stats', getAdminDashboardStats);

module.exports = router;