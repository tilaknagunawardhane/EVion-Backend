const express = require('express');
const router = express.Router();

<<<<<<< HEAD
const { checkStationsExist, createStation, getRequestedStations, deleteStation, updateStation, getStationForEdit, getStationDetails, toggleFavoriteStation, getFavoriteStations, getOwnerStations } = require('../controllers/partneredChargingStationController');
=======
const { checkStationsExist, createStation, getRequestedStations, deleteStation, updateStation, getStationForEdit, getStationDetails, toggleFavoriteStation, getFavoriteStations } = require('../controllers/partneredChargingStationController');
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
const authMiddleware = require('../middlewares/authMiddleware');

// router.get('/check-stations', authMiddleware(['station-owner'], ['station-owner']), checkStationsExist);
router.post('/check-stations', checkStationsExist);
router.post('/create-station', createStation);
router.post('/get-request-stations', getRequestedStations);
router.delete('/delete-station/:id', deleteStation);
router.post('/edit-station/:id', getStationForEdit);
router.put('/update-station/:id', updateStation);
router.post('/station-details/:stationId', getStationDetails);
router.post('/toggle-favorite/:stationId', toggleFavoriteStation);
router.get('/favorites/:userId', getFavoriteStations);
<<<<<<< HEAD
router.get('/owner-stations', getOwnerStations);
=======
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00

module.exports = router;