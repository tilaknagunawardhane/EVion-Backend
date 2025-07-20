const express = require('express');
const router = express.Router();

const { getDistrictsBanks,
    getBranches,
getAllDistricts,
    getConnectorsByType } = require('../controllers/commonController');

router.get('/data', getDistrictsBanks);
router.get('/branches/:bankId', getBranches);
router.get('/districts', getAllDistricts);
router.get('/connectors/:currentType', getConnectorsByType);

module.exports = router;