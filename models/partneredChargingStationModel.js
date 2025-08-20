const mongoose = require('mongoose');
const populateRefFields = require('../utils/populateRefFields');

const ratingSchema = new mongoose.Schema({
    ev_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvOwner',
        required: true
    },
    stars: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5]
    },
    reasons: [{
        type: String,
        required: true
        // You can optionally validate based on `stars` if needed
    }],

}, {
    timestamps: true
});

const chargerSchema = new mongoose.Schema({
    charger_name: {
        type: String,
        required: true
    },
    power_type: {
        type: String,
        required: true,
        enum: ['AC', 'DC']
    },
    max_power_output: {
        type: Number,
        required: true
    },
    price:{
        type: Number,
        required: true
    },
    connector_types: [
        {
            connector: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'connector',
                required: true
            },
            status: {
                type: String,
                enum: ['available', 'unavailable'],
                required: true
            }
        }
    ],
    charger_status: {
        type: String,
        enum: ['processing', 'to_be_installed', 'rejected', 'open', 'unavailable', 'disabled_by_SO', 'deleted'],
        default: 'processing',
        required: true
    },
    rejection_reason: {
        type: String,
        default: null
    },
}, {
    _id: true,
    timestamps: true
})

const partneredChargingStationSchema = new mongoose.Schema({
    station_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'stationowner',
        required: true
    },
    station_name: {
        type: String,
        required: true
    },
    district: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'district',
        required: true
    },
    address: {
        type: String,
        required: false
    },
    city: {
        type: String,
        required: true
    },
    electricity_provider: {
        type: String,
        enum: ['CEB', 'LECO', 'Private'],
        required: false
    },
    power_source: {
        type: String,
        enum: ['Grid', 'Solar', 'Hybrid'],
        required: false
    },
    station_status: {
        type: String,
        enum: ['open', 'unavailable', 'disabled_by_SO', 'deleted'],
        default: 'unavailable',
        required: true
    },
    chargers: [chargerSchema],
    ratings: [ratingSchema]
},
    { 
        _id: true,
        timestamps: true });

const PartneredChargingStation = mongoose.model('partneredChargingStation', partneredChargingStationSchema);
module.exports = PartneredChargingStation;