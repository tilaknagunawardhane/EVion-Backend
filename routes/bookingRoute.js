const express = require('express');
const router = express.Router();
const {addBooking, getBookedSlots, getUserUpcomingBookings, getUserCompletedBookings, getOwnedVehicles, getFavouritePartneredStations } = require('../controllers/bookingController');

router.post('/addBooking', addBooking);
router.get('/getBookedSlots', getBookedSlots);
router.get('/getUserUpcomingBookings', getUserUpcomingBookings);
router.get('/getUserCompletedBookings', getUserCompletedBookings);
router.get('/getOwnedVehicles', getOwnedVehicles);
router.get('/getFavouritePartneredStations', getFavouritePartneredStations);

module.exports = router;