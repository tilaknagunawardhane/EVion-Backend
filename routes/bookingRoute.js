const express = require('express');
const router = express.Router();
const {addBooking, getBookedSlots, getUserUpcomingBookings, getUserCompletedBookings, getOwnedVehicles, getFavouritePartneredStations, getConnectorsByStation, cancelBookingByEvOwner, getUserCancelledBookings } = require('../controllers/bookingController');

router.post('/addBooking', addBooking);
router.get('/getBookedSlots', getBookedSlots);
router.get('/getUserUpcomingBookings', getUserUpcomingBookings);
router.get('/getUserCompletedBookings', getUserCompletedBookings);
router.get('/getOwnedVehicles', getOwnedVehicles);
router.get('/getFavouritePartneredStations', getFavouritePartneredStations);
router.get('/getConnectorsByStation', getConnectorsByStation);
router.post('/cancelBookingByEvOwner', cancelBookingByEvOwner);
router.get('/getUserCancelledBookings', getUserCancelledBookings);

module.exports = router;