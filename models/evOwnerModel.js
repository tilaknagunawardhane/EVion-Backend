const mongoose = require('mongoose');
const populateRefFields = require('../utils/populateRefFields');

const otpSchema = new mongoose.Schema({
    mobile: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: false,
    },
    time: {
        type: Date,
        default: Date.now,
    }
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
    make: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'vehiclemake',
        required: true
    },
    make_info: {  // Embedded field for make
        type: Object,
        default: null
    },
    model: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'vehiclemodel',
        required: true
    },
    model_info: {  // Embedded field for model
        type: Object,
        default: null
    },
    manufactured_year: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not a integer'
        }
    },
    color: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'vehiclecolor',
        required: false
    },
    color_info: {  // Embedded field for color
        type: Object,
        default: null
    },
    vehicle_type: {
        type: String,
        required: false
    },
    battery_capacity: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not a integer'
        }
    },
    connector_type_AC: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'connector',
        required: true
    },
    connector_type_AC_info: {  // Embedded field for AC connector
        type: Object,
        default: null
    },
    connector_type_DC: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'connector',
        required: true
    },
    connector_type_DC_info: {  // Embedded field for DC connector
        type: Object,
        default: null
    },
    battery_health: {
        type: Number,
        required: false
    },
    max_power_AC: {
        type: Number,
        required: false
    },
    max_power_DC: {
        type: Number,
        required: false
    },
    image: {
        type: String,
        required: false
    },
    isActive: {
        type: Boolean,
        default: true,
        required: true
    }
}, {
    _id: true,
    timestamps: true
});

// Apply populateRefFields to all reference fields in vehicleSchema
populateRefFields({
    refField: 'make',
    embedField: 'make_info',
    modelName: 'vehiclemake',
    fields: ['make'] // Specify fields you want to embed
}).applyTo(vehicleSchema);

populateRefFields({
    refField: 'model',
    embedField: 'model_info',
    modelName: 'vehiclemodel',
    fields: ['model']
}).applyTo(vehicleSchema);

populateRefFields({
    refField: 'color',
    embedField: 'color_info',
    modelName: 'vehiclecolor',
    fields: ['color'] // Example fields
}).applyTo(vehicleSchema);

populateRefFields({
    refField: 'connector_type_AC',
    embedField: 'connector_type_AC_info',
    modelName: 'connector',
    fields: ['type_name', 'current_type', 'image']
}).applyTo(vehicleSchema);

populateRefFields({
    refField: 'connector_type_DC',
    embedField: 'connector_type_DC_info',
    modelName: 'connector',
    fields: ['type_name', 'current_type', 'image']
}).applyTo(vehicleSchema);

const evOwnerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    contact_number: {
        type: String,
        required: false,
    },
    home_address: {
        type: String,
        required: false
    },
    email_otp: {
        type: String,
        required: false
    },
    pending_email: {
        type: String,
        required: false
    },
    otp: otpSchema,
    vehicles: [vehicleSchema],
    favourite_stations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'partneredChargingStation'
    }],

        recoveryPhoneNumber: {
            type: String,
            required: false
        },

}, {
    timestamps: true
});

const EvOwner = mongoose.model('EvOwner', evOwnerSchema);
module.exports = EvOwner;