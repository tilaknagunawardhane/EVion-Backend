const mongoose = require('mongoose');

const partneredChargingStationSchema = new mongoose.Schema({
    station_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        // ref: 
        required: true
    },
    station_name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    }
},
    {timestamps: true});

const PartneredChargingStation = mongoose.model('partneredChargingStation', partneredChargingStationSchema);
module.exports = PartneredChargingStation;