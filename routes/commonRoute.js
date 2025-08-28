const express = require('express');
const router = express.Router();

const { getDistrictsBanks,
    getAllDistricts,
    getConnectorsByType } = require('../controllers/commonController');

router.get('/data', getDistrictsBanks);
router.get('/districts', getAllDistricts);
router.get('/connectors/:currentType', getConnectorsByType);

module.exports = router;