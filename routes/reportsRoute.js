const express = require('express');
const router = express.Router();

const { submitStationReport,
    submitChargerReport,
    getBookingDetails,
    submitBookingReport,
    getAllReports,
    getReportDetails,
    saveReportAction
 } = require('../controllers/reportsController');

router.post('/submit-report', submitStationReport);
router.post('/submit-charger-report', submitChargerReport);
router.get('/booking-details/:bookingId', getBookingDetails);
router.post('/submit-booking-report', submitBookingReport);
router.get('/all-reports', getAllReports);
router.get('/report-details/:type/:id', getReportDetails);
router.put('/save-report-action/:type/:id/action', saveReportAction);

module.exports = router;