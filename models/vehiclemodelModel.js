const mongoose = require('mongoose');

const vehiclemodelSchema = new mongoose.Schema({
    model: {
        type: String,
        required: true
    },
    make: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'makes',
        required: true
    }
},
    {timestamps: true});

const VehicleModel = mongoose.model('vehiclemodel', vehiclemodelSchema);
module.exports = VehicleModel;