const express = require('express');
const router = express.Router();
const { registerEvOwner, loginEvOwner } = require('../controllers/evOwnerController');

// Route to register a new EV owner
router.post('/register', registerEvOwner);
// Route to login an existing EV owner
router.post('/login', loginEvOwner);

module.exports = router;