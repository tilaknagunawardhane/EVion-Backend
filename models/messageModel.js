const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chat_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    sender: {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'stationowner', 'supportofficer'],
            required: true
        }
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    messageType: { // For future expansion
        type: String,
        enum: ['text', 'image', 'file', 'system'],
        default: 'text'
    },
    timestamp: { type: Date, default: Date.now },
    seenBy: [{ // Array to track who has seen the message
        userId: mongoose.Schema.Types.ObjectId,
        seenAt: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Message', messageSchema);