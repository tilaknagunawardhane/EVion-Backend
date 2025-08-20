const mongoose = require('mongoose');

const stationReportSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvOwner',
        required: true
    },
    station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'partneredChargingStation',
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

const stationReportModel = mongoose.model('StationReport', stationReportSchema);
module.exports = stationReportModel;