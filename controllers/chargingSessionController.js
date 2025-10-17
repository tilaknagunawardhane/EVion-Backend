// controllers/chargingSessionController.js
const ChargingSession = require('../models/chargingSessionModel');

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
    await ChargingSession.findByIdAndUpdate(sessionId, {
      end_time: new Date(),
      energy_delivered,
      total_cost,
      payment_status: 'completed',
      status: 'completed'
    });
  } catch (err) {
    console.error('❌ Error updating charging session:', err);
    throw err;
  }
};
