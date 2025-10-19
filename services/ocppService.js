// services/ocppService.js
const WebSocket = require('ws');

let wss = null;
let interval = null;
let isRunning = false;
let powerConsumed = 0;

function startOcppServer() {
  console.log('Starting OCPP Server...'); 
  if (isRunning) return { message: 'OCPP server already running' };
  
  const port = 8081; // You can use any available port
  wss = new WebSocket.Server({ port });
  console.log(`🚀 OCPP Server started on ws://localhost:${port}`);
  
  isRunning = true;
  powerConsumed = 0;
  
  interval = setInterval(() => {
    powerConsumed += Math.random() * 0.2; // simulate consumption (kWh)
    const payload = {
      timestamp: new Date().toISOString(),
      powerConsumed: powerConsumed.toFixed(2),
    };

    // Send to all connected WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });

    console.log('🔌 Power update:', payload);
  }, 10000); // every 10 seconds

  return { message: 'OCPP server started successfully', port };
}

function stopOcppServer() {
  if (!isRunning) return { message: 'OCPP server is not running' };

  clearInterval(interval);
  wss.close();
  isRunning = false;
  console.log('🛑 OCPP Server stopped.');

  return { message: 'OCPP server stopped successfully' };
}

module.exports = { startOcppServer, stopOcppServer };
