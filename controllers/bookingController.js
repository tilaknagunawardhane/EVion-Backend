const Booking = require('../models/bookingModel');
const asyncHandler = require('express-async-handler');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const duration = require('dayjs/plugin/duration');
const timezone = require("dayjs/plugin/timezone");
require('dotenv').config();
const mongoose = require('mongoose');
const { getVehicleById, getMakeName, getModelName, getPartneredChargingStation, getConnectorById, getVehiclesByOwner } = require('../utils/helpers');

const slot_size = process.env.SLOT_SIZE;

// Extend dayjs with UTC plugin
dayjs.extend(utc);
dayjs.extend(duration);
dayjs.extend(timezone);

function formatDuration(minutes) {
  const dur = dayjs.duration(minutes, 'minutes');
  const hours = dur.hours();
  const mins = dur.minutes();

  const hourStr = hours > 0 ? `${hours} Hr${hours > 1 ? 's' : ''}` : '';
  const minStr = mins > 0 ? `${mins} Min${mins > 1 ? 's' : ''}` : '';

  return [hourStr, minStr].filter(Boolean).join(' ');
}

const addBooking = asyncHandler(async (req, res) => {
    let {ev_user_id, vehicle_id, charging_station_id, booking_date_time, no_of_slots, charger_id, connector_type_id} = req.body;
    console.log(req.body);

    if(!ev_user_id || !vehicle_id || !charging_station_id || !booking_date_time || !no_of_slots || !charger_id || !connector_type_id){
        res.status(400);      
        throw new Error('Please fill in all booking fields');
    }

    // console.log('booking_date_time: ',booking_date_time);
    // console.log('timezone: ',new Date().getTimezoneOffset());

    // Force it to IST (+5:30)
    booking_date_time = dayjs(booking_date_time).utcOffset(330, true); // 330 minutes = 5.5 hours
    console.log('booking_date_time: ',booking_date_time.format());
    
    if (booking_date_time.isValid()){

        booking_date = booking_date_time.startOf('day'); // start time of the day (midnight) in IST
        start_time = booking_date_time;  //in IST
        end_time = booking_date_time.add(slot_size*no_of_slots, 'minute'); // in IST
        
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
        charging_station_id: '687d2ec70e0c0b8ef0b4186c',
        charger_id,
        connector_type_id,
        booking_date,
        start_time,
        end_time,
        no_of_slots,
        status: 'upcoming'
    });

    if (booking){
        res.status(201).json({ 
            _id: booking._id,
            ev_user_id: booking.ev_user_id,
            vehicle_id: booking.vehicle_id,
            charging_station_id: booking.charging_station_id,
            charger_id: booking.charger_id,
            connector_type_id: booking.connector_type_id,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            no_of_slots: booking.no_of_slots,
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
    .select('vehicle_id charger_id plug_type booking_date start_time end_time no_of_slots charging_station_id connector_type_id'  );

    // console.log('upcomingBookings: ', upcomingBookings);

    if(upcomingBookings.length === 0){
        return res.json({ message: 'No upcoming Bookings' });
    }

    upcomingBookings = upcomingBookings.map(booking => ({
        vehicle_id: booking.vehicle_id,
        dateLabel: dayjs(booking.booking_date).format('MMM D, YYYY'),
        duration: formatDuration(booking.no_of_slots * slot_size),
        startTime: dayjs.utc(booking.start_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
        endTime: dayjs.utc(booking.end_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
        charging_station_id: booking.charging_station_id,
        connector_type_id: booking.connector_type_id,
        // charger_id: booking.charger_id,
        // startTime: booking.start_time,
        // endTime: booking.end_time,
        // slotCount: booking.no_of_slots,
    }));

    upcomingBookings = await Promise.all(
        upcomingBookings.map(async (booking) => {
            try{
                const chargingStationDoc = await getPartneredChargingStation(booking.charging_station_id);
                const chargingStation = chargingStationDoc?.toObject?.() || chargingStationDoc;

                const connectorTypeDoc = await getConnectorById(booking.connector_type_id);
                const connectorType = connectorTypeDoc?.toObject?.() || connectorTypeDoc;

                return{
                    ...booking,
                    stationName: chargingStation.station_name,
                    address: chargingStation.address,
                    connectorType: connectorType.type_name,
                };
            }catch (error){
                return {
                    ...booking,
                    stationName: null,
                    address: null,
                    connectorType: null,
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

    if(!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)){
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }
    ev_user_id = new mongoose.Types.ObjectId(ev_user_id);

    console.log('ev_user_id: ', ev_user_id);

    let completedBookings = await Booking.find({ 
        ev_user_id,
        status: 'completed' })
    .select('vehicle_id charger_id plug_type booking_date start_time end_time no_of_slots charging_station_id connector_type_id cost');

    console.log('completed Bookings: ', completedBookings);

    if(completedBookings.length === 0){
        return res.json({ message: 'No completed Bookings' });
    }

    completedBookings = completedBookings.map(booking => ({
        vehicle_id: booking.vehicle_id,
        dateLabel: dayjs(booking.booking_date).format('MMM D, YYYY'),
        duration: formatDuration(booking.no_of_slots * slot_size),
        startTime: dayjs.utc(booking.start_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
        endTime: dayjs.utc(booking.end_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
        charging_station_id: booking.charging_station_id,
        connector_type_id: booking.connector_type_id,
        cost: booking.cost,
    }));

    completedBookings = await Promise.all(
        completedBookings.map(async (booking) => {
            try{
                const chargingStationDoc = await getPartneredChargingStation(booking.charging_station_id);
                const chargingStation = chargingStationDoc?.toObject?.() || chargingStationDoc;

                const connectorTypeDoc = await getConnectorById(booking.connector_type_id);
                const connectorType = connectorTypeDoc?.toObject?.() || connectorTypeDoc;

                return{
                    ...booking,
                    stationName: chargingStation.station_name,
                    address: chargingStation.address,
                    connectorType: connectorType.type_name,
                };
            }catch (error){
                return {
                    ...booking,
                    stationName: null,
                    address: null,
                    connectorType: null,
                    chargingStation_error: error.message
                }
            }
        })
    );

    // console.log('completedBookings: ', completedBookings);

    const bookingsWithVehicle = await Promise.all(
        completedBookings.map(async (booking) => {
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

const getOwnedVehicles = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let {ev_user_id} = req.query;

    if(!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)){
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }
    ev_user_id = new mongoose.Types.ObjectId(ev_user_id);

    console.log('ev_user_id: ', ev_user_id);

    const ownedVehiclesDoc = await getVehiclesByOwner(ev_user_id);
    let ownedVehicles = ownedVehiclesDoc?.toObject?.() || ownedVehiclesDoc;

    console.log('owned vehicles: ', ownedVehicles);
    console.log('owned make: ', ownedVehicles.vehicles);

    // ownedVehicles = ownedVehicles.vehicles.map(vehicle => ({
    //     id: vehicle._id,
    //     year: vehicle.manufactured_year,
    //     battery: vehicle.battery_capacity,
    //     max_power_DC: vehicle.max_power_DC,
    //     max_power_AC: vehicle.max_power_AC,
    //     image: vehicle.image,
    //     ports: [
    //         vehicle.connector_type_AC,
    //         vehicle.connector_type_DC
    //     ]

    // }))

    console.log('owned vehicles: ', ownedVehicles);
    return res.status(200).json(ownedVehicles);
});

module.exports = {
    addBooking,
    getBookedSlots,
    getUserUpcomingBookings,
    getUserCompletedBookings,
    getOwnedVehicles,
};