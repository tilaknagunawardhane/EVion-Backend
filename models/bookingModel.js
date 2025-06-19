const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    ev_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: false
    },
    vehicle_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicles',
        required: false
    },
    charger_id: {
        type: Number, //change this to object id type
        ref: 'Chargers',
        required: false
    },
    plug_type: {
        type: Number,
        ref: 'Plugs',
        required: false
    },
    booking_date_time: {
        type: Date,
        required: true
    },
    start_time: {
        
    },
    no_of_slots: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not a integer'
        }
    },
    arrival_time: {
        type: Date,
        required: false
    },
    cancelled: {
        type: Number,
        enum: [0,1],
        required: false
    },
    cancelled_at: {
        type: Date,
        required: false
    }
},
    {timestamps: true});

const Booking = mongoose.model('booking', bookingSchema);
module.exports = Booking;
