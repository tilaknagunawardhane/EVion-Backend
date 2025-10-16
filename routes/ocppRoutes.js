const express = require('express');
const router = express.Router();
const { startCharging, stopCharging, getData } = require('../controllers/ocppController');

router.post('/start', startCharging);
router.post('/stop', stopCharging);
router.get('/data', getData);


module.exports = router;
