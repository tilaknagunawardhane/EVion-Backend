const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Connect to DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());


// Routes
// app.use('/api/users', require('./routes/userRoutes'));
const evOwnerRoutes = require('./routes/evOwnerRoute');
const bookingRoutes = require('./routes/bookingRoute');
// const commonRoutes = require('./routes/commonRoute');

app.use('/api/evowners', evOwnerRoutes);
app.use('/api/bookings', bookingRoutes);
// app.use('/api/common', commonRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
