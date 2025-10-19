const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
require('dotenv').config();
const http = require('http'); // 👈 add
const { Server } = require('socket.io'); 


const cookieParser = require('cookie-parser');
const path = require('path');
const startScheduler = require('./config/scheduler');

const app = express();
// Connect to DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// --- SOCKET.IO SETUP ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // or specify your Expo / frontend URL
    methods: ['GET', 'POST'],
  },
});

// make io available globally
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Frontend connected to OCPP WebSocket:', socket.id);
});


// Routes
const evOwnerRoutes = require('./routes/evOwnerRoute');
const bookingRoutes = require('./routes/bookingRoute');
const vehicleRoutes = require('./routes/vehicleRoute');
const commonRoutes = require('./routes/commonRoute');
const partneredChargingStationRoutes = require('./routes/partneredChargingStationRoute');
const adminRoutes = require('./routes/adminRoute');
const discussionRoutes = require('./routes/discussionRoutes');
// const commonRoutes = require('./routes/commonRoute');

const authRoutes = require('./routes/authRoute');
const reportsRoutes = require('./routes/reportsRoute');
const chatRoutes = require('./routes/chatRoute');
const notificationRoutes = require('./routes/notificationRoute');
const chargingSessionRoutes = require('./routes/chargingSessionRoutes');
const ocppRoutes = require('./routes/ocppRoutes');
const walletRoutes = require('./routes/walletRoute');
const stationOwnerEarningsRoutes = require('./routes/stationOwnerEarningsRoute');
const stationOwnerRoute = require('./routes/stationOwnerRoute');
const adminDashboardRoute = require('./routes/adminDashboardRoute');

app.use('/api/evowners', evOwnerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/common', commonRoutes);
app.use('/api/stations', partneredChargingStationRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/reports', reportsRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ocpp', ocppRoutes);
app.use('/api/charging-sessions', chargingSessionRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/station-owner', stationOwnerEarningsRoutes);
app.use('/api/station-owner-dashboard', stationOwnerRoute);
app.use('/api/admin-dashboard', adminDashboardRoute);

app.use('/api/discussions', discussionRoutes);
app.use('/api/auth', authRoutes);

startScheduler(); // Initialize the scheduler

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
