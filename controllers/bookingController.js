const Booking = require('../models/bookingModel');
const asyncHandler = require('express-async-handler');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const duration = require('dayjs/plugin/duration');
require('dotenv').config();
const mongoose = require('mongoose');
const { getVehicleById, getMakeName, getModelName, getPartneredChargingStation } = require('../utils/helpers');

const slot_size = process.env.SLOT_SIZE;

// Extend dayjs with UTC plugin
dayjs.extend(utc);
dayjs.extend(duration);

function formatDuration(minutes) {
  const dur = dayjs.duration(minutes, 'minutes');
  const hours = dur.hours();
  const mins = dur.minutes();

  const hourStr = hours > 0 ? `${hours} Hr${hours > 1 ? 's' : ''}` : '';
  const minStr = mins > 0 ? `${mins} Min${mins > 1 ? 's' : ''}` : '';

  return [hourStr, minStr].filter(Boolean).join(' ');
}

const addBooking = asyncHandler(async (req, res) => {
    let {ev_user_id, vehicle_id, booking_date_time, no_of_slots, charger_id, plug_type} = req.body;
    console.log(req.body);

    if(!booking_date_time || !no_of_slots || !charger_id || !plug_type){
        res.status(400);      
        throw new Error('Please fill in all booking fields');
    }
    
    booking_date_time = dayjs(booking_date_time).utc(); //with utc(), string/date -> date in Z   
    console.log('booking_date_time: ',booking_date_time.format());

    if (booking_date_time.isValid()){

        booking_date = booking_date_time.startOf('day'); //date & time UTC -> date with midnight UTC
        start_time = booking_date_time; //in UTC 
        end_time = booking_date_time.add(slot_size*no_of_slots, 'minute'); //in UTC
        
        console.log('booking_date: ',booking_date.format());
        console.log('start_time: ',start_time.format());
        console.log('end_time: ',end_time.format());
    }
    else{
        console.log('Invalid Date!!');
    }

    // const existingBooking = await Booking.findOne({ booking_date_time: {$lt: booking_date_time}})

    const booking = await Booking.create({
        ev_user_id,
        vehicle_id,
        booking_date,
        start_time,
        end_time,
        no_of_slots,
        charger_id,
        plug_type,
        status: 'upcoming'
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
            plug_type: booking.plug_type,
            status: booking.status
        });
    }else {
        res.status(400);
        throw new Error('Invalid');
    }
});


const getBookedSlots = asyncHandler(async (req,res) => {
    console.log('req.body: ', req.body);

    let {date} = req.body;
    date = dayjs.utc(date);
    console.log('date: ', date.format());
    
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
                    
                    for (let i=0; i<booking.no_of_slots; i++){                
                        slotsSeperately.push({
                            _id: booking._id,
                            booking_date: booking.booking_date,
                            start_time: dayjs(wholeSlotStartTime).add(slot_size*i, 'minute').format("HH:mm:ss"),
                            end_time: dayjs(wholeSlotStartTime).add(slot_size*(i+1), 'minute').format("HH:mm:ss")
                        })
                    }

                }else{
                    slotsSeperately.push({
                        _id: booking._id,
                        booking_date: booking.booking_date,
                        start_time: dayjs(wholeSlotStartTime).add(slot_size*i, 'minute').format("HH:mm:ss"),
                        end_time: dayjs(wholeSlotStartTime).add(slot_size*(i+1), 'minute').format("HH:mm:ss")
                    })
                }
            })
    }else{
        return res.status(400).json({ message: 'Invalid' });
    }
    res.status(200).json(slotsSeperately);
    // console.log(slotsSeperately);
});

const getUserUpcomingBookings = asyncHandler(async (req,res) => {
    console.log('req: ', req.query);
    let {ev_user_id} = req.query;
    
    if(!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)){
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }
    ev_user_id = new mongoose.Types.ObjectId(ev_user_id);

    console.log('ev_user_id: ', ev_user_id);

    let upcomingBookings = await Booking.find({ 
        ev_user_id,
        status: 'upcoming' })
    .select('vehicle_id charger_id plug_type booking_date start_time end_time no_of_slots charging_station_id'  );

    // console.log('upcomingBookings: ', upcomingBookings);

    if(upcomingBookings.length === 0){
        return res.json({ message: 'No upcoming Bookings' });
    }

    upcomingBookings = upcomingBookings.map(booking => ({
        vehicle_id: booking.vehicle_id,
        dateLabel: dayjs(booking.booking_date).format('MMM D, YYYY'),
        duration: formatDuration(booking.no_of_slots * slot_size),
        time: dayjs.utc(booking.start_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
        charging_station_id: booking.charging_station_id,
        // charger_id: booking.charger_id,
        // plugType: booking.plug_type,
        // startTime: booking.start_time,
        // endTime: booking.end_time,
        // slotCount: booking.no_of_slots,
    }));

    upcomingBookings = await Promise.all(
        upcomingBookings.map(async (booking) => {
            try{
                const chargingStationDoc = await getPartneredChargingStation(booking.charging_station_id);
                const chargingStation = chargingStationDoc?.toObject?.() || chargingStationDoc;

                return{
                    ...booking,
                    stationName: chargingStation.station_name,
                    address: chargingStation.address,
                };
            }catch (error){
                return {
                    ...booking,
                    stationName: null,
                    address: null,
                    chargingStation_error: error.message
                }
            }
        })
    );

    // console.log('upcomingBookings: ', upcomingBookings);

    const bookingsWithVehicle = await Promise.all(
        upcomingBookings.map(async (booking) => {
            try {
                const vehicleDoc = await getVehicleById(booking.vehicle_id);
                const vehicle = vehicleDoc?.toObject?.() || vehicleDoc;

                const makeDoc = await getMakeName(vehicle.Make);
                const modelDoc = await getModelName(vehicle.Model);

                const make = makeDoc?.make || '';
                const model = modelDoc?.model || '';
                const type = vehicle?.Vehicle_Type || ''; 

                return {
                    ...booking,
                    carName: `${make} ${model} ${type ? `(${type})` : ''}`.trim(),
                };
            } catch (error) {
                return {
                    ...booking,
                    carName: null,
                    vehicle_error: error.message
                };
            }
        })
    );

    console.log('bookingsWithVehicle: ', bookingsWithVehicle);
    return res.status(200).json(bookingsWithVehicle);
    
});

const getUserCompletedBookings = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let {ev_user_id} = req.query;

    if(!ev_user_id){
       return res.status(400).json({ message: 'No EV user ID' });
    }
    
    if(!mongoose.Types.ObjectId.isValid(ev_user_id)){
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }
    ev_user_id = new mongoose.Types.ObjectId(ev_user_id);

    console.log('ev_user_id: ', ev_user_id);

    const completedBookings = await Booking.find({ 
        ev_user_id,
        status: 'completed' })
    .select('vehicle_id charger_id plug_type booking_date start_time end_time no_of_slots'  );

    console.log('completed Bookings: ', completedBookings);

    if(completedBookings.length > 0){
        return res.status(200).json(completedBookings);
    }else{
        return res.json({ message: 'No completed Bookings' });
    }
})

module.exports = {
    addBooking,
    getBookedSlots,
    getUserUpcomingBookings,
    getUserCompletedBookings
};