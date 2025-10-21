// controllers/ocppController.js
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const Booking = require('../models/bookingModel');
const chargingSessionController = require('./chargingSessionController');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

// In-memory states
let activeSessions = {}; // connectorId -> session info
let chargerLocks = {};   // chargerId -> ev_owner_id (when connected)

// ------------------------------------------------------------------
// 🔍 HELPER: Check for conflicting bookings
async function checkBookingConflict(connectorId, ev_owner_id, chargerId) {
  try {
    // Get current time in IST
    const nowIST = dayjs().tz('Asia/Kolkata');
    const todayMidnightIST = nowIST.startOf('day');
    
    console.log(`🔍 Checking bookings for connector ${connectorId} at ${nowIST.format()}`);

    // Find all bookings from today onwards for this connector
    const bookings = await Booking.find({
      connector_type_id: connectorId,
      charger_id: chargerId,
      booking_date: { $gte: todayMidnightIST.toDate() },
      status: 'upcoming'
    });

    if (bookings.length === 0) {
      console.log('✅ No bookings found - connection allowed');
      return { allowed: true };
    }

    // Check if current time falls within any booking slot
    for (const booking of bookings) {
      const bookingStart = dayjs(booking.start_time);
      const bookingEnd = dayjs(booking.end_time);
      
      // Check if current time is within this booking slot
      if (nowIST.isAfter(bookingStart) && nowIST.isBefore(bookingEnd)) {
        // There's an active booking slot right now
        if (booking.ev_user_id.toString() === ev_owner_id) {
          console.log('✅ Booking found for same user - connection allowed');
          return { 
            allowed: true, 
            booking_id: booking._id,
            message: 'Connected with your booking'
          };
        } else {
          console.log('❌ Booking exists for different user - connection denied');
          return { 
            allowed: false, 
            message: `This connector is booked by another user from ${bookingStart.format('h:mm A')} to ${bookingEnd.format('h:mm A')}`
          };
        }
      }
    }

    // Current time doesn't fall in any booking slot - allow connection
    console.log('✅ No conflicting booking at current time - connection allowed');
    return { allowed: true };

  } catch (error) {
    console.error('❌ Error checking booking conflict:', error);
    throw error;
  }
}

// ------------------------------------------------------------------
// 🔌 CONNECT CHARGER
exports.connectCharger = async (req, res) => {
  try {
    const { connectorId, ev_owner_id } = req.body || {};
    if (!connectorId || !ev_owner_id)
      return res.status(400).json({ error: "connectorId and ev_owner_id required" });

    const station = await PartneredChargingStation.findOne({
      "chargers.connector_types._id": connectorId
    });
    if (!station) return res.status(404).json({ error: "Connector not found" });

    // Find the charger that has this connector
    let foundCharger;
    for (const charger of station.chargers) {
      const connector = charger.connector_types.find(
        c => c._id.toString() === connectorId
      );
      if (connector) {
        foundCharger = charger;
        break;
      }
    }
    if (!foundCharger) return res.status(404).json({ error: "Charger not found" });

    const chargerId = foundCharger._id.toString();

    // 🚫 Check if this charger is already connected/locked
    if (chargerLocks[chargerId]) {
      if (chargerLocks[chargerId] === ev_owner_id) {
        return res.status(400).json({ error: "You have already connected this charger." });
      } else {
        return res.status(409).json({ error: "This charger is already connected by another user." });
      }
    }

    // 📅 Check for booking conflicts
    const bookingCheck = await checkBookingConflict(connectorId, ev_owner_id, chargerId);
    
    if (!bookingCheck.allowed) {
      return res.status(403).json({ 
        error: bookingCheck.message || "This connector is currently booked by another user."
      });
    }

    // ✅ Lock the charger for this user
    chargerLocks[chargerId] = ev_owner_id;

    console.log(`🔌 Charger ${chargerId} connected by user ${ev_owner_id}`);

    res.json({
      message: bookingCheck.message || "Charger connected successfully. You can now start charging.",
      chargerId,
      stationId: station._id,
      booking_id: bookingCheck.booking_id || null
    });
  } catch (err) {
    console.error("❌ connectCharger error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------------------------------------------------------
// ⚡ START CHARGING
exports.startCharging = async (req, res) => {
  try {
    const { connectorId, booking_id, ev_owner_id } = req.body || {};
    if (!connectorId || !ev_owner_id)
      return res.status(400).json({ error: "connectorId and ev_owner_id required" });

    const station = await PartneredChargingStation.findOne({
      "chargers.connector_types._id": connectorId
    });
    if (!station) return res.status(404).json({ error: "Connector not found" });

    // Find charger
    let foundCharger;
    for (const charger of station.chargers) {
      const connector = charger.connector_types.find(
        c => c._id.toString() === connectorId
      );
      if (connector) {
        foundCharger = charger;
        break;
      }
    }
    if (!foundCharger) return res.status(404).json({ error: "Charger not found" });

    const chargerId = foundCharger._id.toString();

    // 🔒 Must be connected by this same user before starting
    if (!chargerLocks[chargerId]) {
      return res.status(403).json({ error: "You must connect the charger first before starting." });
    }
    if (chargerLocks[chargerId] !== ev_owner_id) {
      return res.status(403).json({ error: "This charger is connected by another user." });
    }

    // Also ensure not already charging
    if (activeSessions[connectorId]) {
      return res.status(400).json({ error: "Charging session is already active for this connector." });
    }

    const { max_power_output, price } = foundCharger;
    const startTime = new Date();

    // Create DB entry
    const newSession = await chargingSessionController.createSession({
      booking_id,
      ev_owner_id,
      station_id: station._id,
      charger_id: foundCharger._id,
      connector_id: connectorId,
      price_per_kwh: price
    });

    // Simulation parameters
    let secondsElapsed = 0;
    let totalEnergy = 0; // kWh

    // ✅ Store active session before starting interval
    activeSessions[connectorId] = {
      sessionId: newSession._id,
      stationId: station._id,
      stationName: station.station_name,
      chargerId: foundCharger._id,
      price,
      latestData: { currentPower: 0, totalEnergy: 0, secondsElapsed: 0 },
      ev_owner_id,
      startTime,
      interval: null
    };

    // ⚙️ Simulation interval (every 5 seconds instead of 1)
    const interval = setInterval(() => {
      const session = activeSessions[connectorId];
      if (!session) {
        clearInterval(interval);
        return;
      }

      const variation = Math.random() * 0.15 + 0.85; // 85%–100%
      const currentPower = max_power_output * variation;

      secondsElapsed += 5;
      totalEnergy += (currentPower * 5) / 3600; // energy for 5 seconds

      session.latestData = { currentPower, totalEnergy, secondsElapsed };
    }, 5000);

    // Assign interval to session
    activeSessions[connectorId].interval = interval;

    // ⏱️ Auto-stop failsafe after 2 hours
    setTimeout(() => {
      if (activeSessions[connectorId]) {
        console.log(`⏹️ Auto-stopping charger ${connectorId} due to timeout`);
        clearInterval(activeSessions[connectorId].interval);
        delete chargerLocks[activeSessions[connectorId].chargerId];
        delete activeSessions[connectorId];
      }
    }, 2 * 60 * 60 * 1000);

    res.json({
      message: "Charging started successfully",
      session_id: newSession._id,
      station_name: station.station_name,
      start_time: startTime,
      max_power_output,
      price
    });
  } catch (err) {
    console.error("❌ startCharging error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------------------------------------------------------
// 📊 GET CHARGING DATA
exports.getData = (req, res) => {
  try {
    const { connectorId } = req.query;
    const session = activeSessions[connectorId];
    if (!session) return res.status(404).json({ error: "No active session" });

    const { latestData, price } = session;
    const totalCost = (latestData.totalEnergy || 0) * price;

    res.json({
      power: latestData.currentPower || 0,
      totalEnergy: latestData.totalEnergy || 0,
      timeElapsed: latestData.secondsElapsed || 0,
      cost: totalCost
    });
  } catch (err) {
    console.error("❌ getData error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ------------------------------------------------------------------
// ⏹️ STOP CHARGING
exports.stopCharging = async (req, res) => {
  try {
    const { connectorId, ev_owner_id } = req.body || {};
    const session = activeSessions[connectorId];
    if (!session) return res.status(404).json({ error: "No active session" });

    // Ensure same user
    if (session.ev_owner_id !== ev_owner_id) {
      return res.status(403).json({ error: "You are not authorized to stop this session." });
    }

    clearInterval(session.interval);

    const { latestData, price, sessionId, chargerId, stationName, startTime } = session;
    const totalCost = (latestData.totalEnergy || 0) * price;
    const endTime = new Date();
    const durationMs = endTime - startTime;
    const durationMinutes = (durationMs / 60000).toFixed(1);

    // Complete session in DB
    await chargingSessionController.completeSession(sessionId, {
      energy_delivered: latestData.totalEnergy || 0,
      total_cost: totalCost,
      end_time: endTime
    });

    // Cleanup memory
    delete activeSessions[connectorId];
    delete chargerLocks[chargerId];

    res.json({
      message: "Charging stopped and charger disconnected successfully.",
      station_name: stationName,
      date: startTime.toISOString().split("T")[0],
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      total_energy_kwh: (latestData.totalEnergy || 0).toFixed(3),
      cost_per_kwh: price,
      total_cost: totalCost.toFixed(2)
    });
  } catch (err) {
    console.error("❌ stopCharging error:", err);
    res.status(500).json({ error: "Server error" });
  }
};