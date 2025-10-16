// controllers/ocppController.js
const { startOcppServer, stopOcppServer } = require('../services/ocppService');

exports.startCharging = (req, res) => {
  console.log('Received request to start OCPP server');
  const result = startOcppServer();
  res.json(result);
};

exports.stopCharging = (req, res) => {
  const result = stopOcppServer();
  res.json(result);
};
