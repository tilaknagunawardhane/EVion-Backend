const express = require('express');
const router = express.Router();
const {getDropdownData} = require('../controllers/vehicleController');

router.get('/dropdowndata', getDropdownData);

module.exports = router;