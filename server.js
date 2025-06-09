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

app.use('/api/evowners', evOwnerRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
