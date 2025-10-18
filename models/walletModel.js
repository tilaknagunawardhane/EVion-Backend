const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    ev_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvOwner',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'LKR',
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'frozen', 'closed'],
        default: 'active',
        required: true
    }
}, {
    timestamps: true
});

// Create wallet automatically when EV owner registers
// walletSchema.index({ ev_owner_id: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;