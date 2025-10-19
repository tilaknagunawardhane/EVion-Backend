const WebSocket = require('ws');

const PORT = 9220;
const server = new WebSocket.Server({ port: PORT });

console.log(`✅ OCPP Central System running at ws://localhost:${PORT}`);

server.on('connection', (socket, req) => {
  const chargePointId = req.url.replace('/', '');
  console.log(`🔌 New charge point connected: ${chargePointId}`);

  socket.on('message', (message) => {
    console.log(`📩 Message from ${chargePointId}: ${message}`);

    const [messageType, messageId, action, payload] = JSON.parse(message);

    if (messageType === 2) {
      let response;

      switch (action) {
        case 'BootNotification':
          response = [3, messageId, {
            status: 'Accepted',
            currentTime: new Date().toISOString(),
            interval: 300
          }];
          break;
        case 'StartTransaction':
          response = [3, messageId, {
            idTagInfo: { status: 'Accepted' },
            transactionId: Math.floor(Math.random() * 10000)
          }];
          break;
        case 'StopTransaction':
          response = [3, messageId, {
            idTagInfo: { status: 'Accepted' }
          }];
          break;
        default:
          response = [4, messageId, 'NotImplemented', {}];
      }

      socket.send(JSON.stringify(response));
    }
  });
});
