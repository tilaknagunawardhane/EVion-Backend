const Booking = require('../models/bookingModel');
const asyncHandler = require('express-async-handler');
const dayjs = require('dayjs')
const slot_size = process.env.SLOT_SIZE;


const addBooking = asyncHandler(async (req, res) => {
    let {booking_date_time, no_of_slots, charger_id, plug_type} = req.body;
    console.log(req.body);

    if(!booking_date_time || !no_of_slots || !charger_id || !plug_type){
        res.status(400);      
        throw new Error('Please fill in all booking fields');
    }

    // console.log(booking_date_time);
    booking_date_time = dayjs(booking_date_time);
    if (booking_date_time.isValid()){
        console.log(booking_date_time.format());
    }
    else{
        console.log('Invalid Date!!');
    }

    const booking = await Booking.create({
        booking_date_time,
        no_of_slots,
        charger_id,
        plug_type
    });

    if (booking){
        res.status(201).json({ 
            //
        });
    }else {
        res.status(400);
        throw new Error('Invalid');
    }
});

module.exports = {
    addBooking
};