const express = require('express');
const router = express.Router();

const { submitStationReport,
    submitChargerReport,
    getBookingDetails
 } = require('../controllers/reportsController');

router.post('/submit-report', submitStationReport);
router.post('/submit-charger-report', submitChargerReport);
router.get('/booking-details/:bookingId', getBookingDetails);

module.exports = router;