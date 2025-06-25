const express = require('express');
const router = express.Router();
const {addBooking, getBookedSlots, getUserUpcomingBookings} = require('../controllers/bookingController');

router.post('/addBooking', addBooking);
router.get('/getBookedSlots', getBookedSlots);
router.get('/getUserUpcomingBookings', getUserUpcomingBookings);

module.exports = router;