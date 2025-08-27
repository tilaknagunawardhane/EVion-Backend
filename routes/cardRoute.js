const express = require('express');
const router = express.Router();
const { createPreapproval, preapprovalNotify } = require('../controllers/cardController');

router.post('/create-preapproval', createPreapproval);
router.post('/preapproval-notify', preapprovalNotify);

module.exports = router;
