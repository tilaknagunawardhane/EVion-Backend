const express = require('express');
const router = express.Router();
const {
    getAdminRequests,
    getRequestDetails,
    updateRequestStatus
} = require('../controllers/adminController');

router.get('/get-requests', getAdminRequests);
router.get('/request-details/:id', getRequestDetails);
router.put('/update-request-status/:id', updateRequestStatus);

module.exports = router;