const WebSocket = require('ws');

const CHARGE_POINT_ID = 'EVion_CP_001';
const SERVER_URL = `ws://localhost:9220/${CHARGE_POINT_ID}`;

const socket = new WebSocket(SERVER_URL);

socket.on('open', () => {
  console.log('🔋 Connected to Central System');

  // BootNotification message
  const bootMessage = [2, '1', 'BootNotification', {
    chargePointVendor: 'EVion',
    chargePointModel: 'EV-Sim'
  }];
  socket.send(JSON.stringify(bootMessage));

  // Wait 2s → Send StartTransaction
  setTimeout(() => {
    const startTx = [2, '2', 'StartTransaction', {
      connectorId: 1,
      idTag: 'USER_001',
      meterStart: 100,
      timestamp: new Date().toISOString()
    }];
    socket.send(JSON.stringify(startTx));
  }, 2000);

  // Wait 7s → Send StopTransaction
  setTimeout(() => {
    const stopTx = [2, '3', 'StopTransaction', {
      transactionId: 1234,
      meterStop: 150,
      timestamp: new Date().toISOString()
    }];
    socket.send(JSON.stringify(stopTx));
  }, 7000);
});

socket.on('message', (data) => {
  console.log('📨 From Central System:', data.toString());
});

socket.on('close', () => {
  console.log('🔌 Disconnected from Central System');
});
