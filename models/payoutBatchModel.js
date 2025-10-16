const mongoose = require('mongoose');

const payoutBatchSchema = new mongoose.Schema({
    batch_number: {
        type: String,
        required: true,
        unique: true
    },
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    
    total_amount: {
        type: Number,
        required: true
    },
    total_station_owners: {
        type: Number,
        required: true
    },
    
    status: {
        type: String,
        enum: ['draft', 'approved', 'processing', 'completed', 'failed'],
        default: 'draft',
        required: true
    },
    
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false
    },
    
    payouts: [{
        station_owner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'stationowner',
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed'],
            default: 'pending'
        },
        bank_reference: {
            type: String,
            required: false
        },
        paid_at: {
            type: Date,
            required: false
        }
    }],
    
    notes: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

const PayoutBatch = mongoose.model('PayoutBatch', payoutBatchSchema);
module.exports = PayoutBatch;