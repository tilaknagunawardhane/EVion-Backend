const express = require('express');
const router = express.Router();
const {addBooking, getBookedSlots} = require('../controllers/bookingController');

router.post('/addBooking', addBooking);
router.get('/getBookedSlots', getBookedSlots);

module.exports = router;