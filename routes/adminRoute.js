const express = require('express');
const router = express.Router();
const {
    getAdminRequests
} = require('../controllers/adminController');

router.get('/get-requests', getAdminRequests);

module.exports = router;