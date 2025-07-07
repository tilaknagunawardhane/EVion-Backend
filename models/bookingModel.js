const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    ev_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'evowners',
        required: true
    },
    vehicle_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'vehicles',
        required: true
    },
    charging_station_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'partneredChargingStations',
        required: true
    },
    charger_id: {
        type: Number, //change this to object id type
        ref: 'Chargers',
        required: true
    },
    connector_type_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'connectors',
        required: true
    },
    booking_date: {
        type: Date, // Date only, 2000-05-16T00:00:00Z (midnight)
        required: true,
        index: true 
    },
    start_time: {
        type: Date,
        required: true
    },
    end_time: {
        type: Date, 
        required: true
    },
    no_of_slots: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not a integer'
        }
    },
    status: {
        type: String,
        enum: ['upcoming', 'completed', 'cancelled', 'no_show'],
        required: true
    },
    arrival_time: {
        type: Date,
        required: false
    },
    cancelled_at: {
        type: Date,
        required: false
    },
    cost: {
        type: Number,
        required: false
    }
},
    {timestamps: true});

const Booking = mongoose.model('booking', bookingSchema);
module.exports = Booking;
