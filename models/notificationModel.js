const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipientType: {
        type: String,
        required: true,
        enum: ['admin', 'stationowner', 'supportofficer', 'evowner']
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'recipientModel'
    },
    recipientModel: {
        type: String,
        required: true,
        enum: ['Admin', 'stationowner', 'SupportOfficer', 'EvOwner']
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'station_added',
            'station_approved',
            'station_rejected',
            'new_report',
            'booking_confirmation',
            'charging_complete',
            'system_alert'
        ]
    },
    relatedEntity: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: false
        },
        model: {
            type: String,
            required: false,
            enum: ['PartneredChargingStation', 'Report', 'Booking']
        }
    },
    isRead: {
        type: Boolean,
        default: false
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('Notification', notificationSchema);