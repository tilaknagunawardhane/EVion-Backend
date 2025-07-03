const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    ev_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'evowners',
        required: true
    },
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
    vehicle_type: {
        type: String,
        required: true
    },
    battery_capacity: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not a integer'
        } 
    },
    plug_types: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not a integer'
        } 
    },
    battery_health: {
        type: String,
        required: true
    },
    max_charging_power: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not a integer'
        }
    }
},
    {timestamps: true});

const Vehicle = mongoose.model('vehicle', vehicleSchema);
module.exports = Vehicle;