const express = require('express');
const router = express.Router();

const { submitStationReport,
    submitChargerReport,
    getBookingDetails,
    submitBookingReport
 } = require('../controllers/reportsController');

router.post('/submit-report', submitStationReport);
router.post('/submit-charger-report', submitChargerReport);
router.get('/booking-details/:bookingId', getBookingDetails);
router.post('/submit-booking-report', submitBookingReport);

module.exports = router;