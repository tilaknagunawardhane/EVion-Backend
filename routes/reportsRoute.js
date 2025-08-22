const express = require('express');
const router = express.Router();

const { submitStationReport,
    submitChargerReport
 } = require('../controllers/reportsController');

router.post('/submit-report', submitStationReport);
router.post('/submit-charger-report', submitChargerReport);

module.exports = router;