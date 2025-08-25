const express = require('express');
const router = express.Router();

const { submitStationReport,
    submitChargerReport,
    getBookingDetails,
    submitBookingReport,
    getAllReports,
    getReportDetails,
    saveReportAction,
    updateRefund,
    getEvOwnerReports,
    getEvOwnerReportDetails
 } = require('../controllers/reportsController');

router.post('/submit-report', submitStationReport);
router.post('/submit-charger-report', submitChargerReport);
router.get('/booking-details/:bookingId', getBookingDetails);
router.post('/submit-booking-report', submitBookingReport);
router.get('/all-reports', getAllReports);
router.get('/report-details/:type/:id', getReportDetails);
router.put('/save-report-action/:type/:id/action', saveReportAction);
router.put('/refund-reports/:type/:id/refund', updateRefund);

router.get('/get-evowner-reports/:userId', getEvOwnerReports);
router.get('/get-evowner-report-details/:userId/:type/:reportId', getEvOwnerReportDetails);

module.exports = router;