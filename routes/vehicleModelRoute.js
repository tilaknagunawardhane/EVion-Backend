const express = require('express');
const router = express.Router();
const {getModelName} = require('../controllers/vehicleModelController');

router.get('/getModelName', getModelName);

module.exports = router;