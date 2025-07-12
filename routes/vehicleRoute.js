const express = require('express');
const router = express.Router();
const {getDropdownData, getConnectorTypes, uploadVehicleImage, addVehicle} = require('../controllers/vehicleController');

router.get('/dropdowndata', getDropdownData);
router.get('/connectors', getConnectorTypes);
router.post('/addVehicle', uploadVehicleImage, addVehicle);

module.exports = router;