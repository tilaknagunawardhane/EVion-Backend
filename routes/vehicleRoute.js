const express = require('express');
const router = express.Router();
const {getDropdownData, getConnectorTypes, uploadVehicleImage, addVehicle, fetchVehicles} = require('../controllers/vehicleController');

router.get('/dropdowndata', getDropdownData);
router.get('/connectors', getConnectorTypes);
router.post('/addVehicle', uploadVehicleImage, addVehicle);
router.post('/fetchVehicles', fetchVehicles );

module.exports = router;