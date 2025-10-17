const express = require('express');
const router = express.Router();
const { connectCharger, startCharging, stopCharging, getData } = require('../controllers/ocppController');

router.post('/connect', connectCharger);
router.post('/start', startCharging);
router.post('/stop', stopCharging);
router.get('/data', getData);


module.exports = router;
