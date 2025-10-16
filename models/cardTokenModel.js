const mongoose = require('mongoose');

const cardTokenSchema = new mongoose.Schema({
    ev_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EvOwner',
        required: true
    },
    token_id: {
        type: String,
        required: true,
        index: true
    },
    card_mask: {
        type: String,
        required: true
    },
    card_type: {
        type: String,
        required: true,
        enum: ['VISA', 'MASTER', 'AMEX', 'OTHER']
    },
    card_holder_name: {
        type: String,
        default: ''
    },
    expiry_month: {
        type: String,
        default: ''
    },
    expiry_year: {
        type: String,
        default: ''
    },
    is_default: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted'],
        default: 'active'
    },
    last_used: {
        type: Date,
        default: Date.now
    },
    metadata: {
        payment_gateway: {
            type: String,
            default: 'payhere'
        },
        saved_at: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true
});

// Compound index to ensure unique active tokens per user
cardTokenSchema.index({ 
    ev_owner_id: 1, 
    token_id: 1, 
    status: 1 
}, { 
    unique: true,
    partialFilterExpression: { status: 'active' }
});

// Index for quick retrieval of user's active cards
cardTokenSchema.index({ 
    ev_owner_id: 1, 
    status: 1, 
    is_default: -1 
});

// Pre-save middleware to ensure only one default card per user
cardTokenSchema.pre('save', async function(next) {
    if (this.isModified('is_default') && this.is_default === true) {
        try {
            // Remove default from other active cards of the same user
            await mongoose.model('CardToken').updateMany(
                {
                    ev_owner_id: this.ev_owner_id,
                    _id: { $ne: this._id },
                    status: 'active',
                    is_default: true
                },
                {
                    is_default: false
                }
            );
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Static method to get user's default card
cardTokenSchema.statics.getDefaultCard = function(evOwnerId) {
    return this.findOne({
        ev_owner_id: evOwnerId,
        status: 'active',
        is_default: true
    });
};

// Static method to get all active cards for a user
cardTokenSchema.statics.getActiveCards = function(evOwnerId) {
    return this.find({
        ev_owner_id: evOwnerId,
        status: 'active'
    }).sort({ is_default: -1, last_used: -1 });
};

// Instance method to soft delete card
cardTokenSchema.methods.softDelete = function() {
    this.status = 'deleted';
    this.is_default = false;
    return this.save();
};

// Instance method to update last used timestamp
cardTokenSchema.methods.updateLastUsed = function() {
    this.last_used = new Date();
    return this.save();
};

// Virtual for formatted card display
cardTokenSchema.virtual('display_name').get(function() {
    return `${this.card_type} ${this.card_mask}`;
});

// Virtual for expiry date
cardTokenSchema.virtual('expiry_date').get(function() {
    if (this.expiry_month && this.expiry_year) {
        return `${this.expiry_month}/${this.expiry_year}`;
    }
    return 'N/A';
});

const CardToken = mongoose.model('CardToken', cardTokenSchema);

module.exports = CardToken;