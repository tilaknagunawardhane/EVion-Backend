const mongoose = require('mongoose');

const chargerReportSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'evowner',
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
    category: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    attachments:[{
        type: String,
        required: false
    }],
    status: {
        type: String,
        enum: ['under-review', 'resolved', 'rejected'],
        default: 'under-review',
        required: true
    },
    action:{
        type: String,
        required: false,
        default: null
    },
    rejected_reason: {
        type: String,
        required: false,
        default: null
    },
    resolved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false
    },
    resolved_at: {
        type: Date,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
})

const chargerReportModel = mongoose.model('ChargerReport', chargerReportSchema);
module.exports = chargerReportModel;