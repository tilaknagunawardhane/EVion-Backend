const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    participants: [{
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'stationowner', 'supportofficer'],
            required: true
        },
        modelType: { // Added to know which collection to reference
            type: String,
            enum: ['Admin', 'stationowner', 'SupportOfficer'],
            required: true
        }
    }],
    lastMessage: {
        text: String,
        senderId: mongoose.Schema.Types.ObjectId, // Added sender info
        senderRole: String,
        timestamp: Date
    },
    topic: {
        type: String,
        enum: ['stationApproval', 'chargerApproval', 'reportIssue', 'general', 'support'],
        default: 'general'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', chatSchema);
