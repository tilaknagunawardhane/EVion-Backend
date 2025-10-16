// routes/ocppRoutes.js
const express = require('express');
const router = express.Router();
const ocppController = require('../controllers/ocppController');

router.post('/start', ocppController.startCharging);
router.post('/stop', ocppController.stopCharging);

module.exports = router;
