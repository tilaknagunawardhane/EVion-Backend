const Booking = require('../models/bookingModel');
const asyncHandler = require('express-async-handler');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const slot_size = process.env.SLOT_SIZE;

// Extend dayjs with UTC plugin
dayjs.extend(utc);

const addBooking = asyncHandler(async (req, res) => {
    let {booking_date_time, no_of_slots, charger_id, plug_type} = req.body;
    console.log(req.body);

    if(!booking_date_time || !no_of_slots || !charger_id || !plug_type){
        res.status(400);      
        throw new Error('Please fill in all booking fields');
    }
    
    booking_date_time = dayjs(booking_date_time).utc(); //with utc(), string/date -> date in Z   
    console.log(booking_date_time.format());

    if (booking_date_time.isValid()){

        booking_date = booking_date_time.startOf('day'); //date & time UTC -> date with midnight UTC
        start_time = booking_date_time.format('HH:mm:ss'); //in UTC as a string
        end_time = booking_date_time.add(slot_size*no_of_slots, 'minute').format('HH:mm:ss'); //in UTC as a string
        
        // console.log(booking_date.format());
        // console.log(start_time);
        // console.log(end_time);
    }
    else{
        console.log('Invalid Date!!');
    }

    // const existingBooking = await Booking.findOne({ booking_date_time: {$lt: booking_date_time}})

    const booking = await Booking.create({
        booking_date_time,
        booking_date,
        start_time,
        end_time,
        no_of_slots,
        charger_id,
        plug_type
    });

    if (booking){
        res.status(201).json({ 
            _id: booking._id,
            booking_date_time: booking.booking_date_time,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            no_of_slots: booking.no_of_slots,
            charger_id: booking.charger_id,
            plug_type: booking.plug_type
        });
    }else {
        res.status(400);
        throw new Error('Invalid');
    }
});


const getBookedSlots = asyncHandler(async (req,res) => {
    let {date} = req.body;
    console.log(date);
    date = dayjs.utc(date);
    console.log(date.format());
    
    if (!date){
        res.status(400);
        throw new Error('No date');
    }

    const bookedSlots = await Booking.find({ booking_date: date })
    const slotsSeperately = [];

    if(bookedSlots.length >= 0 ){
            bookedSlots.map(booking => {
            
                if(booking.no_of_slots > 1){
                    const wholeSlotStartTime = booking.start_time;
                    const wholeSlotEndTime = booking.end_time;
                    
                    for (let i=0; i<booking.no_of_slots; i++){                
                        slotsSeperately.push({
                            _id: booking._id,
                            booking_date: booking.booking_date,
                            start_time: dayjs(`2000-01-01T${wholeSlotStartTime}`).add(slot_size*i, 'minute').format("HH:mm:ss"),
                            end_time: dayjs(`2000-01-01T${wholeSlotStartTime}`).add(slot_size*(i+1), 'minute').format("HH:mm:ss")
                        })
                    }

                }else{
                    slotsSeperately.push({
                        _id: booking._id,
                        booking_date: booking.booking_date,
                        start_time: dayjs(`2000-01-01T${wholeSlotStartTime}`).add(slot_size*i, 'minute').format("HH:mm:ss"),
                        end_time: dayjs(`2000-01-01T${wholeSlotStartTime}`).add(slot_size*(i+1), 'minute').format("HH:mm:ss")
                    })
                }
            })
    }else{
        res.status(400);
        throw new Error('Invalid');
    }
    res.status(200).json(slotsSeperately);
    // console.log(slotsSeperately);
});

module.exports = {
    addBooking,
    getBookedSlots
};