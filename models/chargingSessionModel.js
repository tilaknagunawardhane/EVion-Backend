const mongoose = require('mongoose');

const chargingSessionSchema = new mongoose.Schema({
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'booking',
        required: true
    },
    ev_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvOwner',
        required: true
    },
    station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'partneredChargingStation',
        required: true
    },
    charger_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'partneredChargingStation.chargers',
        required: true
    },
    connector_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'partneredChargingStation.chargers.connector_types',
        required: true
    },
    
    start_time: {
        type: Date,
        required: true
    },
    end_time: {
        type: Date,
        required: false
    },
    
    energy_delivered: {
        type: Number, // kWh
        required: false
    },
    
    price_per_kwh: {
        type: Number,
        required: true
    },
    
    total_cost: {
        type: Number,
        required: false
    },
    
    payment_status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending',
        required: true
    },
    
    transaction_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: false
    },
    
    status: {
        type: String,
        enum: ['active', 'completed', 'interrupted', 'failed'],
        default: 'active',
        required: true
    }
}, {
    timestamps: true
});

const ChargingSession = mongoose.model('ChargingSession', chargingSessionSchema);
module.exports = ChargingSession;