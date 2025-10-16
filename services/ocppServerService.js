const WebSocket = require('ws');

let serverInstance = null;

function startOcppServer(port = 9220) {
  if (serverInstance) return serverInstance;

  serverInstance = new WebSocket.Server({ port });
  console.log(`✅ OCPP Central System running at ws://localhost:${port}`);

  serverInstance.on('connection', (socket, req) => {
    const chargePointId = req.url.replace('/', '');
    console.log(`🔌 Charge Point connected: ${chargePointId}`);

    socket.on('message', (message) => {
      console.log(`📩 From ${chargePointId}: ${message}`);
      try {
        const [messageType, messageId, action, payload] = JSON.parse(message);

        if (messageType === 2) {
          let response;
          switch (action) {
            case 'BootNotification':
              response = [3, messageId, { status: 'Accepted', currentTime: new Date().toISOString(), interval: 300 }];
              break;
            case 'StartTransaction':
              response = [3, messageId, { idTagInfo: { status: 'Accepted' }, transactionId: Math.floor(Math.random() * 10000) }];
              break;
            case 'StopTransaction':
              response = [3, messageId, { idTagInfo: { status: 'Accepted' } }];
              break;
            default:
              response = [4, messageId, 'NotImplemented', {}];
          }
          socket.send(JSON.stringify(response));
        }
      } catch (err) {
        console.error('Invalid OCPP message', err);
      }
    });
  });

  return serverInstance;
}

function stopOcppServer() {
  if (serverInstance) {
    serverInstance.close(() => console.log('OCPP server stopped.'));
    serverInstance = null;
  }
}

module.exports = { startOcppServer, stopOcppServer };
