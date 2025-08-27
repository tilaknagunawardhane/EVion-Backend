const express = require('express');
const router = express.Router();

const { submitStationReport,
<<<<<<< HEAD
    submitChargerReport,
    getBookingDetails,
    submitBookingReport,
    getAllReports,
    getReportDetails,
    saveReportAction,
    updateRefund
=======
    submitChargerReport
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
 } = require('../controllers/reportsController');

router.post('/submit-report', submitStationReport);
router.post('/submit-charger-report', submitChargerReport);
<<<<<<< HEAD
router.get('/booking-details/:bookingId', getBookingDetails);
router.post('/submit-booking-report', submitBookingReport);
router.get('/all-reports', getAllReports);
router.get('/report-details/:type/:id', getReportDetails);
router.put('/save-report-action/:type/:id/action', saveReportAction);
router.put('/refund-reports/:type/:id/refund', updateRefund);
=======
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00

module.exports = router;