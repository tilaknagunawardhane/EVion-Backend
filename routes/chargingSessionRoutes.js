const express = require('express');
const router = express.Router();
//const chargingSessionController = require('../controllers/chargingSessionController');
const { getSessionsByUser } = require('../controllers/chargingSessionController');

// POST: get all sessions by user
console.log('🔄 Setting up route for fetching user charging sessions');
router.post('/user', getSessionsByUser);

module.exports = router;
