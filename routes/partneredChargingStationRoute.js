const express = require('express');
const router = express.Router();

const { checkStationsExist } = require('../controllers/partneredChargingStationController');
const authMiddleware = require('../middlewares/authMiddleware');

// router.get('/check-stations', authMiddleware(['station-owner'], ['station-owner']), checkStationsExist);
router.post('/check-stations', checkStationsExist);

module.exports = router;