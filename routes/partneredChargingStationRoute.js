const express = require('express');
const router = express.Router();

const { checkStationsExist, createStation } = require('../controllers/partneredChargingStationController');
const authMiddleware = require('../middlewares/authMiddleware');

// router.get('/check-stations', authMiddleware(['station-owner'], ['station-owner']), checkStationsExist);
router.post('/check-stations', checkStationsExist);
router.post('/create-station', createStation);

module.exports = router;