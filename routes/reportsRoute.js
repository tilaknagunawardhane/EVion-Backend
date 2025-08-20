const express = require('express');
const router = express.Router();

const { submitStationReport } = require('../controllers/reportsController');

router.post('/submit-report', submitStationReport);

module.exports = router;