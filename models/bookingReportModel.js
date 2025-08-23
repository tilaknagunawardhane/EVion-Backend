const mongoose = require('mongoose');

const bookingReportSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvOwner',
        required: true
    },
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'booking2',
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
    is_refunded: {
        type: Boolean,
        required: false,
        default: false
    },
    refund_amount: {
        type: Number,
        required: false,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
})

const BookingReportModel = mongoose.model('BookingReport', bookingReportSchema);
module.exports = BookingReportModel;