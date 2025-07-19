const mongoose = require('mongoose');

const stationOwnerSchema = new mongoose.Schema({
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
}, { timestamps: true });

const StationOwner = mongoose.model('StationOwner', stationOwnerSchema);
module.exports = StationOwner;