const mongoose = require('mongoose');
const { applyTimestamps } = require('./evOwnerModel');

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
        // minlength: 6
    },
    role: {
        type: String,
        default: 'supportOfficer',
        enum: ['admin', 'supportOfficer'],
    },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);