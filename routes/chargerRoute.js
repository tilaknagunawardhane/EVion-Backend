const express = require('express');
const router = express.Router();

const { getChargerDetailsForStation, getSingleChargerProfileData, getSessionsByCharger, getBookingsByCharger } = require('../controllers/chargerController');

// Route to get charger details for a station owner
router.get('/:stationId/charger-table', getChargerDetailsForStation);
// Route to get single charger profile data
router.get('/:stationId/:chargerId/profile', getSingleChargerProfileData);
router.get('/:chargerId/sessions', getSessionsByCharger);
router.get('/:chargerId/bookings', getBookingsByCharger);

module.exports = router;