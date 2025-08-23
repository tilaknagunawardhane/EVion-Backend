const mongoose = require('mongoose');
const { applyTimestamps } = require('./evOwnerModel');

const supportOfficer = new mongoose.Schema({
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
        default: 'supportofficer',
    },
}, { timestamps: true });

module.exports = mongoose.model('SupportOfficer', supportOfficer);