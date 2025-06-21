const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    mobile: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: false,
    },
    time: {
        type: Date,
        default: Date.now,
    }
}, {_id: false});

const evOwnerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,

    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    contact_number: {
        type: String,
        required: false,
    },
    home_address: {
        type: String,
        required: false
    },
    otp: otpSchema,
},
    { timestamps: true });

const EvOwner = mongoose.model('EvOwner', evOwnerSchema);
module.exports = EvOwner;