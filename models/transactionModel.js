const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    wallet_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: true,
        index: true
    },
    ev_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvOwner',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'topup',              // User adds money to wallet
            'booking_charge',     // Deduct booking fee
            'charging_charge',    // Deduct charging fee
            'refund_booking',     // Refund booking fee (station closed/report)
            'refund_charging',    // Refund charging fee (if needed)
        ],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    balance_before: {
        type: Number,
        required: true
    },
    balance_after: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        required: true
    },
    
    // Reference to related entities
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
    report_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BookingReport',
        required: false
    },
    
    // Payment gateway details (for topup only)
    payment_method: {
        type: String,
        enum: ['wallet', 'card', 'bank_transfer'],
        required: false
    },
    payment_gateway_ref: {
        type: String, // PayHere or other gateway reference
        required: false
    },
    
    description: {
        type: String,
        required: true
    },
    
    metadata: {
        type: mongoose.Schema.Types.Mixed, // Any additional info
        required: false
    }
}, {
    timestamps: true
});

// Indexes for querying
// transactionSchema.index({ ev_owner_id: 1, createdAt: -1 });
// transactionSchema.index({ booking_id: 1 });
// transactionSchema.index({ charging_session_id: 1 });
// transactionSchema.index({ status: 1 });
// transactionSchema.index({ type: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;