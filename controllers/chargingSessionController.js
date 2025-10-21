// controllers/chargingSessionController.js
const ChargingSession = require('../models/chargingSessionModel');
const WalletService = require('../services/walletService');
const StationOwner = require('../models/stationOwnerModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const Booking = require('../models/bookingModel');
/**
 * Create a new charging session in the DB
 */
exports.createSession = async ({ booking_id, ev_owner_id, station_id, charger_id, connector_id, price_per_kwh }) => {
  try {
    const newSession = await ChargingSession.create({
      booking_id,
      ev_owner_id,
      station_id,
      charger_id,
      connector_id,
      start_time: new Date(),
      price_per_kwh,
      payment_status: 'pending',
      status: 'active'
    });
    return newSession;
  } catch (err) {
    console.error('❌ Error creating charging session:', err);
    throw err;
  }
};

/**
 * Update a charging session when stopped
 */
exports.completeSession = async (sessionId, { energy_delivered, total_cost }) => {
  try {
    // Find the charging session with populated data
    const chargingSession = await ChargingSession.findById(sessionId)
      .populate('station_id')
      .populate('booking_id');

    if (!chargingSession) {
      throw new Error('Charging session not found');
    }

    const evOwnerId = chargingSession.ev_owner_id;
    const stationId = chargingSession.station_id._id;
    
    // Get the station owner ID directly from the station document
    const station = await PartneredChargingStation.findById(stationId);
    if (!station) {
      throw new Error('Station not found');
    }
    
    const stationOwnerId = station.station_owner_id;
    
    // Verify station owner exists
    const stationOwner = await StationOwner.findById(stationOwnerId);
    if (!stationOwner) {
      throw new Error('Station owner not found');
    }

    // Get booking ID if exists
    const bookingId = chargingSession.booking_id?._id || null;

    console.log('Processing charging payment:', {
      sessionId,
      evOwnerId,
      stationId: stationId.toString(),
      stationOwnerId: stationOwnerId.toString(),
      bookingId: bookingId?.toString(),
      total_cost,
      energy_delivered
    });

    // Charge the EV owner for the charging session
    await WalletService.chargeForCharging(
      evOwnerId,
      sessionId,
      total_cost,
      stationId,
      stationOwnerId,
      bookingId
    );

    // Update the charging session with completion details
    await ChargingSession.findByIdAndUpdate(sessionId, {
      end_time: new Date(),
      energy_delivered,
      total_cost,
      payment_status: 'completed',
      status: 'completed'
    });

    // Update booking status to 'completed' if this session was associated with a booking
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        // Only update if booking is still in 'upcoming' status (not cancelled)
        if (booking.status === 'upcoming') {
          await Booking.findByIdAndUpdate(bookingId, {
            status: 'completed',
            // You can also add completion timestamp if needed
            completed_at: new Date()
          });
        } else {
          console.log(`ℹ️  Booking ${bookingId} not updated - current status: ${booking.status}`);
        }
      } else {
        console.log(`⚠️  Booking ${bookingId} not found`);
      }
    } else {
      console.log('ℹ️  No booking associated with this charging session');
    }

    console.log('✅ Charging session completed and payment processed successfully');

  } catch (err) {
    console.error('❌ Error completing charging session:', err);
    throw err;
  }
};

// controllers/chargingSessionController.js

exports.getSessionsByUser = async (req, res) => {
  try {
    console.log('📥 Received request body:', req.body);
    const { ev_owner_id } = req.body;

    // Fetch sessions for this user, no nested populate
    const sessions = await ChargingSession.find({ ev_owner_id }).sort({ start_time: -1 });

    // Format for frontend
    const formattedSessions = sessions.map((s) => {
      const start = new Date(s.start_time);
      const end = s.end_time ? new Date(s.end_time) : new Date();
      const durationMs = end - start;

      const totalSeconds = Math.floor(durationMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const formattedDuration = `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;

      return {
        id: s._id,
        ev_owner_id: s.ev_owner_id,
        station_id: s.station_id,
        charger_id: s.charger_id,
        connector_id: s.connector_id,
        start_time: s.start_time,
        end_time: s.end_time,
        duration: formattedDuration,
        energy_delivered: s.energy_delivered || 0,
        price_per_kwh: s.price_per_kwh,
        total_cost: s.total_cost || 0,
        payment_status: s.payment_status,
        status: s.status,
        transaction_id: s.transaction_id || null,
      };
    });

    res.json(formattedSessions);
  } catch (err) {
    console.error('❌ Error fetching sessions:', err);
    res.status(500).json({ message: 'Server error fetching sessions' });
  }
};

