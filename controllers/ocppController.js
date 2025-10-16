// controllers/ocppController.js
const PartneredChargingStation = require('../models/partneredChargingStationModel');

// Store active sessions
let activeSessions = {};

exports.startCharging = async (req, res) => {
  try {
    const { connectorId } = req.body;
    if (!connectorId) return res.status(400).json({ error: 'connectorId required' });

    // Find charger that has the connectorId
    const station = await PartneredChargingStation.findOne({ "chargers.connector_types._id": connectorId });

    if (!station) return res.status(404).json({ error: 'Connector not found' });

    let foundCharger;
    for (const charger of station.chargers) {
      const connector = charger.connector_types.find(c => c._id.toString() === connectorId);
      if (connector) {
        foundCharger = charger;
        break;
      }
    }

    if (!foundCharger) return res.status(404).json({ error: 'Charger not found' });

    const { max_power_output, price } = foundCharger;

    // Create simulation data
    let secondsElapsed = 0;
    let totalEnergy = 0; // in kWh

    // Interval for updates every 10s
    const interval = setInterval(() => {
      const variation = (Math.random() * 0.15 + 0.85); // between 85% and 100%
      const currentPower = max_power_output * variation;
      secondsElapsed += 10;
      totalEnergy += (currentPower * 10) / 3600; // kWh = kW * (time in hours)
      console.log('⚡ Sending update:', { connectorId, currentPower, totalEnergy, secondsElapsed });

      // Store last update (optional)
      activeSessions[connectorId].latestData = { currentPower, totalEnergy, secondsElapsed };
    }, 10_000);

    // Save session info
    activeSessions[connectorId] = {
      stationId: station._id,
      chargerId: foundCharger._id,
      price,
      interval,
      totalEnergy: 0,
      secondsElapsed: 0,
      latestData: {}
    };

    return res.json({
      message: 'Charging started',
      max_power_output,
      price
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getData = (req, res) => {
  const { connectorId } = req.query;
  const session = activeSessions[connectorId];
  if (!session) return res.status(404).json({ error: 'No active session' });

  const { latestData, price } = session;
  const totalCost = (latestData.totalEnergy || 0) * price;

  return res.json({
    power: latestData.currentPower || 0,
    totalEnergy: latestData.totalEnergy || 0,
    timeElapsed: latestData.secondsElapsed || 0,
    cost: totalCost
  });
};

exports.stopCharging = async (req, res) => {
  try {
    const { connectorId } = req.body;
    const session = activeSessions[connectorId];
    if (!session) return res.status(404).json({ error: 'No active session' });

    clearInterval(session.interval);

    const { latestData, price } = session;
    const totalCost = (latestData.totalEnergy || 0) * price;

    delete activeSessions[connectorId];

    return res.json({
      message: 'Charging stopped',
      totalEnergy: latestData.totalEnergy || 0,
      totalCost
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
