const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser');

const app = express();

// Connect to DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());


// Routes
// app.use('/api/users', require('./routes/userRoutes'));
const evOwnerRoutes = require('./routes/evOwnerRoute');
const bookingRoutes = require('./routes/bookingRoute');
// const commonRoutes = require('./routes/commonRoute');
const authRoutes = require('./routes/authRoute');

// const adminRoutes = require('./routes/adminRoutes');
// const evOwnerRoutes = require('./routes/evOwnerRoutes');
// const stationOwnerRoutes = require('./routes/stationOwnerRoutes');

app.use('/api/evowners', evOwnerRoutes);
app.use('/api/bookings', bookingRoutes);
// app.use('/api/common', commonRoutes);

app.use('/api/auth', authRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/ev-owner', evOwnerRoutes);
// app.use('/api/station-owner', stationOwnerRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
