const express = require('express');
const router = express.Router();

const { getDistrictsBanks,
    getBranches } = require('../controllers/commonController');

router.get('/data', getDistrictsBanks);
router.get('/branches/:bankId', getBranches);

module.exports = router;