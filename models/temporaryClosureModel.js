const mongoose = require('mongoose');

const temporaryClosureSchema = new mongoose.Schema({
    station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'partneredChargingStation', // Links to your main station model
        required: true
    },
    owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'stationowner',
        required: true
    },
    from_date_time: {
        type: Date,
        required: true
    },
    to_date_time: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'cancelled'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TemporaryClosure', temporaryClosureSchema);