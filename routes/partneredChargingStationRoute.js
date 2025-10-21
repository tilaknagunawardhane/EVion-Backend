const express = require('express');
const router = express.Router();

const { checkStationsExist, createStation, getRequestedStations, deleteStation, updateStation, updateStationSchedule, getStationForEdit,
    getStationDetails,
    toggleFavoriteStation,
    getFavoriteStations,
    getOwnerStations,
    getStationById, getStationChargers, updateCharger,
    addChargerToStation,
    getAllStationsForSupportOfficer,
    getStationDetailsForSupportOfficer,
    getStationsForMap,
    getAllStationsForAdminDash,
    getOwnerStationsForMap
    
} = require('../controllers/partneredChargingStationController');

const { getTemporaryClosures, createTemporaryClosure, cancelTemporaryClosure } = require('../controllers/tempClosureController');

const authMiddleware = require('../middlewares/authMiddleware');

// router.get('/check-stations', authMiddleware(['station-owner'], ['station-owner']), checkStationsExist);
router.post('/check-stations', checkStationsExist);
router.post('/create-station', createStation);
router.post('/get-request-stations', getRequestedStations);
router.delete('/delete-station/:id', deleteStation);
router.post('/edit-station/:id', getStationForEdit);
router.put('/update-station/:id', updateStation);
router.put('/update-station-schedule/:id', updateStationSchedule);
router.post('/station-details/:stationId', getStationDetails);
router.post('/toggle-favorite/:stationId', toggleFavoriteStation);
router.get('/favorites/:userId', getFavoriteStations);
router.get('/owner-stations', getOwnerStations);
router.get('/station/:stationId', getStationById);
router.get('/station/:stationId/chargers', getStationChargers);
router.put('/station/:stationId/update-charger/:chargerId', updateCharger);
router.post('/station/:stationId/add-charger', addChargerToStation);
router.get('/support-officer/stations', getAllStationsForSupportOfficer);
router.get('/support-officer/stations/:stationId', getStationDetailsForSupportOfficer);
router.get('/map/stations', getStationsForMap);

router.get('/:stationId/temporary-closure', getTemporaryClosures);
router.post('/:stationId/create-temporary-closure', createTemporaryClosure);
router.put('/:stationId/remove-temporary-closure/:closureId', cancelTemporaryClosure);
router.get('/all-stations', getAllStationsForAdminDash);
router.get('/owner-stations', getOwnerStationsForMap);

module.exports = router;