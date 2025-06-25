const express = require('express');
const router = express.Router();
const {getModelName, getMakeName} = require('../controllers/commonController');

router.get('/getModelName', getModelName);
router.get('/getMakeName', getMakeName);


module.exports = router;