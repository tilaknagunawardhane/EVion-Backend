const mongoose = require('mongoose');

const vehiclemakeSchema = new mongoose.Schema({
    make: {
        type: String,
        required: true
    }
},
    {timestamps: true});

const VehicleMake = mongoose.model('vehiclemake', vehiclemakeSchema);
module.exports = VehicleMake;