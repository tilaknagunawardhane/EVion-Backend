const mongoose = require('mongoose');

const vehicleColorSchema = new mongoose.Schema({
    color: String

}, {timestamps: true}
);

const VehicleColor = mongoose.model('vehiclecolor', vehicleColorSchema);
module.exports = VehicleColor;