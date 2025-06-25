const express = require('express');
const router = express.Router();
const {addBooking, getBookedSlots, getUserUpcomingBookings, getUserCompletedBookings } = require('../controllers/bookingController');

router.post('/addBooking', addBooking);
router.get('/getBookedSlots', getBookedSlots);
router.get('/getUserUpcomingBookings', getUserUpcomingBookings);
router.get('/getUserCompletedBookings', getUserCompletedBookings);

module.exports = router;