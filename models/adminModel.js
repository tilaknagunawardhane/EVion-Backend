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
<<<<<<< HEAD
        default: 'admin',
        // enum: ['admin', 'supportofficer'],
=======
        default: 'supportOfficer',
        enum: ['admin', 'supportOfficer'],
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
    },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);