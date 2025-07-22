const express = require('express');
const router = express.Router();
const {
    getAdminRequests,
    getRequestDetails
} = require('../controllers/adminController');

router.get('/get-requests', getAdminRequests);
router.get('/request-details/:id', getRequestDetails);

module.exports = router;