const express = require('express');
const router = express.Router();
const {getDropdownData, getConnectorTypes} = require('../controllers/vehicleController');

router.get('/dropdowndata', getDropdownData);
router.get('/connectors', getConnectorTypes)

module.exports = router;