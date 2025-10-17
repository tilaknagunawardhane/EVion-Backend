// controllers/ocppController.js
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const chargingSessionController = require('./chargingSessionController');

// In-memory states
let activeSessions = {};     // connectorId -> session info
let chargerLocks = {};       // chargerId -> ev_owner_id (when connected)

// ------------------------------------------------------------------
// 🔌 CONNECT CHARGER
exports.connectCharger = async (req, res) => {
  try {
    const { connectorId, ev_owner_id } = req.body;
    if (!connectorId || !ev_owner_id)
      return res.status(400).json({ error: "connectorId and ev_owner_id required" });

    const station = await PartneredChargingStation.findOne({ "chargers.connector_types._id": connectorId });
    if (!station) return res.status(404).json({ error: "Connector not found" });

    // Find the charger that has this connector
    let foundCharger;
    for (const charger of station.chargers) {
      const connector = charger.connector_types.find(c => c._id.toString() === connectorId);
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

    // ✅ Lock the charger for this user
    chargerLocks[chargerId] = ev_owner_id;

    console.log(`🔌 Charger ${chargerId} connected by user ${ev_owner_id}`);

    res.json({
      message: "Charger connected successfully. You can now start charging.",
      chargerId,
      stationId: station._id
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
    const { connectorId, booking_id, ev_owner_id } = req.body;
    if (!connectorId || !ev_owner_id)
      return res.status(400).json({ error: "connectorId and ev_owner_id required" });

    const station = await PartneredChargingStation.findOne({ "chargers.connector_types._id": connectorId });
    if (!station) return res.status(404).json({ error: "Connector not found" });

    // Find charger
    let foundCharger;
    for (const charger of station.chargers) {
      const connector = charger.connector_types.find(c => c._id.toString() === connectorId);
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

    // Create DB entry
    const newSession = await chargingSessionController.createSession({
      booking_id,
      ev_owner_id,
      station_id: station._id,
      charger_id: foundCharger._id,
      connector_id: connectorId,
      price_per_kwh: price
    });

    // Start simulation
    let secondsElapsed = 0;
    let totalEnergy = 0; // kWh

    const interval = setInterval(() => {
      const variation = Math.random() * 0.15 + 0.85;
      const currentPower = max_power_output * variation;
      secondsElapsed += 10;
      totalEnergy += (currentPower * 10) / 3600;

      console.log("⚡ Power update:", {
        connectorId,
        currentPower: currentPower.toFixed(2),
        totalEnergy: totalEnergy.toFixed(3),
        secondsElapsed
      });

      activeSessions[connectorId].latestData = { currentPower, totalEnergy, secondsElapsed };
    }, 10_000);

    // Store active session
    activeSessions[connectorId] = {
      sessionId: newSession._id,
      stationId: station._id,
      chargerId: foundCharger._id,
      price,
      interval,
      latestData: { currentPower: 0, totalEnergy: 0, secondsElapsed: 0 },
      ev_owner_id
    };

    res.json({
      message: "Charging started successfully",
      session_id: newSession._id,
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
};

// ------------------------------------------------------------------
// ⏹️ STOP CHARGING
exports.stopCharging = async (req, res) => {
  try {
    const { connectorId, ev_owner_id } = req.body;
    const session = activeSessions[connectorId];
    if (!session) return res.status(404).json({ error: "No active session" });

    // Ensure same user
    if (session.ev_owner_id !== ev_owner_id) {
      return res.status(403).json({ error: "You are not authorized to stop this session." });
    }

    clearInterval(session.interval);

    const { latestData, price, sessionId, chargerId } = session;
    const totalCost = (latestData.totalEnergy || 0) * price;

    // Complete session in DB
    await chargingSessionController.completeSession(sessionId, {
      energy_delivered: latestData.totalEnergy || 0,
      total_cost: totalCost
    });

    // Cleanup memory
    delete activeSessions[connectorId];
    delete chargerLocks[chargerId]; // disconnects automatically

    res.json({
      message: "Charging stopped and charger disconnected successfully.",
      totalEnergy: latestData.totalEnergy || 0,
      totalCost: totalCost.toFixed(2)
    });
  } catch (err) {
    console.error("❌ stopCharging error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
