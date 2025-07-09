const mongoose = require('mongoose');

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
}, {_id: false});

const vehicleSchema = new mongoose.Schema({
    make: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'vehiclemake',
        required: true
    },
    model: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'vehiclemodel',
        required: true
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
    connector_type_DC: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'connector',
        required: true
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
    }
},{
  _id: true,
  timestamps: true  // ✅ This enables createdAt and updatedAt
})

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
    otp: otpSchema,
    vehicles: [vehicleSchema],
},
    { timestamps: true });

const EvOwner = mongoose.model('EvOwner', evOwnerSchema);
module.exports = EvOwner;