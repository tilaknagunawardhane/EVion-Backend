const express = require('express');
const router = express.Router();

const { 
    getOwnerDashboardStats, 
    getConnectorStatusChartData, 
    getFaultReportsStatus, 
    getStackedSessionsChartData,
    getOverviewChartData

} = require('../controllers/stationOwnerDashboardController');

const authMiddleware = require('../middlewares/authMiddleware');

router.get('/stats', getOwnerDashboardStats);
router.get('/connector-status', getConnectorStatusChartData);
router.get('/fault-reports', getFaultReportsStatus);
router.get('/sessions', getStackedSessionsChartData);
router.get('/overview', getOverviewChartData);

module.exports = router;