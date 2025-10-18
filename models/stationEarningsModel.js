const mongoose = require('mongoose');

const stationEarningsSchema = new mongoose.Schema({
    station_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'stationowner',
        required: true,
        index: true
    },
    station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'partneredChargingStation',
        required: true,
        index: true
    },
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'booking',
        required: false
    },
    charging_session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChargingSession',
        required: false
    },
    
    type: {
        type: String,
        enum: ['booking_fee', 'charging_fee'],
        required: true
    },
    
    gross_amount: {
        type: Number,
        required: true
    },
    platform_commission: {
        type: Number,
        required: true
    },
    net_amount: {
        type: Number, // Amount station owner receives
        required: true
    },
    commission_percentage: {
        type: Number,
        default: 10, // e.g., 10% commission
        required: true
    },
    
    payout_status: {
        type: String,
        enum: ['pending', 'processing', 'paid', 'on_hold'],
        default: 'pending',
        required: true
    },
    payout_batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayoutBatch',
        required: false
    },
    paid_at: {
        type: Date,
        required: false
    },
    
    month: {
        type: Number, // 1-12
        required: true
    },
    year: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

stationEarningsSchema.index({ station_owner_id: 1, payout_status: 1 });
stationEarningsSchema.index({ year: 1, month: 1 });

const StationEarnings = mongoose.model('StationEarnings', stationEarningsSchema);
module.exports = StationEarnings;