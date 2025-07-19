// models/stationOwnerModel.js
const mongoose = require('mongoose');

const stationOwnerSchema = new mongoose.Schema({
    // Personal Information
    name: {
        type: String,
        required: [true, 'Name is required'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
    },
    contact: {
        type: String,
        required: [true, 'Contact number is required'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
    },
    nic: {
        type: String,
        required: [true, 'NIC is required'],
        unique: true,
    },
    nicImage: {
        type: String, // Path to stored image
        required: [true, 'NIC image is required']
    },

    // Business Information
    businessName: {
        type: String,
        required: false
    },
    businessRegistrationNumber: {
        type: String,
        required: false,
        // unique: true
    },
    taxId: {
        type: String,
        required: false,
        // unique: true
    },

    // Location Information
    district: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'District',
        required: false
    },

    // Bank Account Information
    accountHolderName: {
        type: String,
        required: [true, 'Account holder name is required'],
        trim: true
    },
    bank: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bank',
        required: [true, 'Bank is required']
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: [true, 'Branch is required'],
    },
    accountNumber: {
        type: String,
        required: [true, 'Account number is required'],
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});


const StationOwner = mongoose.model('StationOwner', stationOwnerSchema);

module.exports = StationOwner;