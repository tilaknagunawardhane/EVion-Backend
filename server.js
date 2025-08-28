const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
// Connect to DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


// Routes
// app.use('/api/users', require('./routes/userRoutes'));
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

// const adminRoutes = require('./routes/adminRoutes');
// const evOwnerRoutes = require('./routes/evOwnerRoutes');
// const stationOwnerRoutes = require('./routes/stationOwnerRoutes');

app.use('/api/evowners', evOwnerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/common', commonRoutes);
app.use('/api/stations', partneredChargingStationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/ev-owner', evOwnerRoutes);
// app.use('/api/station-owner', stationOwnerRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
