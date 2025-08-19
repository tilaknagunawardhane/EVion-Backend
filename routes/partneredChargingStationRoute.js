const express = require('express');
const router = express.Router();

const { checkStationsExist, createStation, getRequestedStations, deleteStation, updateStation, getStationForEdit, getStationDetails } = require('../controllers/partneredChargingStationController');
const authMiddleware = require('../middlewares/authMiddleware');

// router.get('/check-stations', authMiddleware(['station-owner'], ['station-owner']), checkStationsExist);
router.post('/check-stations', checkStationsExist);
router.post('/create-station', createStation);
router.post('/get-request-stations', getRequestedStations);
router.delete('/delete-station/:id', deleteStation);
router.post('/edit-station/:id', getStationForEdit);
router.put('/update-station/:id', updateStation);
router.post('/station-details/:stationId', getStationDetails);

module.exports = router;