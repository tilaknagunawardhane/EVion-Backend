const Booking = require('../models/bookingModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const EvOwner = require('../models/evOwnerModel');
const WalletService = require('../services/walletService');
const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');

const asyncHandler = require('express-async-handler');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const duration = require('dayjs/plugin/duration');
const timezone = require("dayjs/plugin/timezone");
require('dotenv').config();
const mongoose = require('mongoose');
const { getVehicleById, getMakeName, getModelName, getPartneredChargingStation, getConnectorById, getVehiclesByOwner } = require('../utils/helpers');

const slot_size = process.env.SLOT_SIZE;
const BOOKING_FEE = 100;


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
    let { ev_user_id, vehicle_id, charging_station_id, booking_date_time, no_of_slots, connector_type_id } = req.body;
    console.log(req.body);

    if (!ev_user_id || !vehicle_id || !charging_station_id || !booking_date_time || !no_of_slots || !connector_type_id) {
        res.status(400);
        throw new Error('Please fill in all booking fields');
    }

    const hasSufficientBalance = await WalletService.hasSufficientBalance(
        ev_user_id,
        BOOKING_FEE
    );

    if (!hasSufficientBalance) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient wallet balance. Please top up your wallet.',
            required_amount: BOOKING_FEE,
            current_balance: await WalletService.getBalance(ev_user_id)
        });
    }

    // Fetch station with chargers + connectors populated
    const station = await PartneredChargingStation.findById(charging_station_id)
        .populate({
            path: 'chargers',
            populate: { path: 'connectors' }
        });

    // console.log('Station: ', station);

    if (!station) {
        res.status(404);
        throw new Error('Station not found');
    }

    // get charger belongs to connector
    let charger_id = null;

    for (const charger of station.chargers) {
        const match = charger.connector_types.find(
            (c) => c._id.toString() === connector_type_id.toString()
        );
        if (match) {
            charger_id = charger._id;
            break;
        }
    }

    if (!charger_id) {
        res.status(400);
        throw new Error('No charger found for the given connector');
    }

    // console.log('booking_date_time: ', booking_date_time);
    // console.log('timezone: ',new Date().getTimezoneOffset());

    // Force it to IST (+5:30)
    booking_date_time = dayjs(booking_date_time).utcOffset(330, true); // 330 minutes = 5.5 hours
    // console.log('booking_date_time: ', booking_date_time.format());

    if (booking_date_time.isValid()) {

        booking_date = booking_date_time.startOf('day'); // start time of the day (midnight) in IST
        start_time = booking_date_time;  //in IST
        end_time = booking_date_time.add(slot_size * no_of_slots, 'minute'); // in IST

        // console.log('booking_date: ', booking_date.format());
        // console.log('start_time: ', start_time.format());
        // console.log('end_time: ', end_time.format());

    }
    else {
        console.log('Invalid Date!!');
    }

    // const existingBooking = await Booking.findOne({ booking_date_time: {$lt: booking_date_time}})

    const booking = await Booking.create({
        ev_user_id,
        vehicle_id,
        charging_station_id,
        charger_id,
        connector_type_id,
        booking_date,
        start_time,
        end_time,
        no_of_slots,
        status: 'upcoming',
        cost: BOOKING_FEE
    });


    if (booking) {

        // Charge booking fee from wallet
        await WalletService.chargeBookingFee(
            ev_user_id,
            booking._id,
            BOOKING_FEE,
            charging_station_id,
            station.station_owner_id
        );

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
            status: booking.status,
            wallet_balance: await WalletService.getBalance(ev_user_id)
        });
    } else {
        res.status(400);
        throw new Error('Invalid');
    }

});


const getBookedSlots = asyncHandler(async (req, res) => {
    console.log('req.body: ', req.body);

    let { date } = req.body;
    date = dayjs.utc(date);
    console.log('date: ', date.format());

    if (!date) {
        res.status(400);
        throw new Error('No date');
    }

    const bookedSlots = await Booking.find({ booking_date: date })
    const slotsSeperately = [];

    if (bookedSlots.length >= 0) {
        bookedSlots.map(booking => {

            if (booking.no_of_slots > 1) {
                const wholeSlotStartTime = booking.start_time;

                for (let i = 0; i < booking.no_of_slots; i++) {
                    slotsSeperately.push({
                        _id: booking._id,
                        booking_date: booking.booking_date,
                        start_time: dayjs(wholeSlotStartTime).add(slot_size * i, 'minute').format("HH:mm:ss"),
                        end_time: dayjs(wholeSlotStartTime).add(slot_size * (i + 1), 'minute').format("HH:mm:ss")
                    })
                }

            } else {
                slotsSeperately.push({
                    _id: booking._id,
                    booking_date: booking.booking_date,
                    start_time: dayjs(wholeSlotStartTime).add(slot_size * i, 'minute').format("HH:mm:ss"),
                    end_time: dayjs(wholeSlotStartTime).add(slot_size * (i + 1), 'minute').format("HH:mm:ss")
                })
            }
        })
    } else {
        return res.status(400).json({ message: 'Invalid' });
    }
    res.status(200).json(slotsSeperately);
    // console.log(slotsSeperately);
});

const getUserUpcomingBookings = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let { ev_user_id } = req.query;

    if (!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)) {
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }
    ev_user_id = new mongoose.Types.ObjectId(ev_user_id);

    console.log('ev_user_id: ', ev_user_id);

    let upcomingBookings = await Booking.find({
        ev_user_id,
        status: 'upcoming'
    })
        .populate({
            path: 'charging_station_id',
            populate: {
                path: 'chargers.connector_types.connector', // deep populate
                model: 'connector'
            }
        })
        .populate({
            path: 'ev_user_id',
            populate: {
                path: 'vehicles.make',
                model: 'vehiclemake'
            }
        })
        .populate({
            path: 'ev_user_id',
            populate: {
                path: 'vehicles.model',
                model: 'vehiclemodel'
            }
        })
        ;

    // console.log('upcomingBookings: ', upcomingBookings);

    if (upcomingBookings.length === 0) {
        return res.json({ message: 'No upcoming Bookings' });
    }

    upcomingBookings = upcomingBookings.map(booking => {
        const station = booking.charging_station_id;
        const charger = station?.chargers.id(booking.charger_id);
        const connector = charger?.connector_types.id(booking.connector_type_id);
        const vehicle = booking.ev_user_id?.vehicles.id(booking.vehicle_id);

        return {
            ...booking.toObject?.() ?? booking,
            charger,
            connector: connector.connector,
            vehicle,
            dateLabel: dayjs(booking.booking_date).format('MMM D, YYYY'),
            duration: formatDuration(booking.no_of_slots * slot_size),
            startTime: dayjs.utc(booking.start_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
            endTime: dayjs.utc(booking.end_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
        }
    });

    // console.log('upcomingBookings: ', upcomingBookings);
    return res.status(200).json(upcomingBookings);

});

const getUserCompletedBookings = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let { ev_user_id } = req.query;

    if (!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)) {
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }
    ev_user_id = new mongoose.Types.ObjectId(ev_user_id);

    console.log('ev_user_id: ', ev_user_id);

    let completedBookings = await Booking.find({
        ev_user_id,
        status: 'completed'
    })
        .populate({
            path: 'charging_station_id',
            populate: {
                path: 'chargers.connector_types.connector', // deep populate
                model: 'connector'
            }
        })
        .populate({
            path: 'ev_user_id',
            populate: {
                path: 'vehicles.make',
                model: 'vehiclemake'
            }
        })
        .populate({
            path: 'ev_user_id',
            populate: {
                path: 'vehicles.model',
                model: 'vehiclemodel'
            }
        })
        ;

    // console.log('completedBookings: ', completedBookings);

    if (completedBookings.length === 0) {
        return res.json({ message: 'No completed Bookings' });
    }

    completedBookings = completedBookings.map(booking => {
        const station = booking.charging_station_id;
        const charger = station?.chargers.id(booking.charger_id);
        const connector = charger?.connector_types.id(booking.connector_type_id);
        const vehicle = booking.ev_user_id?.vehicles.id(booking.vehicle_id);

        return {
            ...booking.toObject?.() ?? booking,
            charger,
            connector: connector.connector,
            vehicle,
            dateLabel: dayjs(booking.booking_date).format('MMM D, YYYY'),
            duration: formatDuration(booking.no_of_slots * slot_size),
            startTime: dayjs.utc(booking.start_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
            endTime: dayjs.utc(booking.end_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
        }
    });

    // console.log('completedBookings: ', completedBookings);
    return res.status(200).json(completedBookings);

});

const getOwnedVehicles = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let { ev_user_id } = req.query;

    if (!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)) {
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

    // console.log('owned vehicles: ', ownedVehicles);
    return res.status(200).json(ownedVehicles);
});

const getFavouritePartneredStations = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let { ev_user_id } = req.query;

    if (!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)) {
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }

    const favouritePartneredStations = await EvOwner.findById(ev_user_id)
        .select('favourite_stations')
        .populate('favourite_stations');

    console.log('favourites: ', favouritePartneredStations.favourite_stations);

    return res.status(200).json(favouritePartneredStations.favourite_stations);
});

const getConnectorsByStation = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let { station_id } = req.query;

    if (!station_id || !mongoose.Types.ObjectId.isValid(station_id)) {
        return res.status(400).json({ message: 'Invalid station user ID' });
    }

    const station = await PartneredChargingStation.findById(station_id)
        .populate('chargers.connector_types.connector');

    const connectors = station.chargers.flatMap(charger => charger.connector_types);

    console.log('connectors: ', connectors);
    return res.status(200).json(connectors);




});
const cancelBookingByEvOwner = asyncHandler(async (req, res) => {
    const { booking_id, ev_user_id } = req.body;

    if (!booking_id || !ev_user_id) {
        res.status(400);
        throw new Error('Booking ID and EV user ID are required');
    }

    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction();

            // Find the booking with session
            const booking = await Booking.findOne({
                _id: booking_id,
                ev_user_id: ev_user_id,
                status: 'upcoming'
            }).session(session);

            if (!booking) {
                throw new Error('Booking not found or not eligible for cancellation');
            }

            // Calculate time difference between booking creation and now
            const bookingCreatedAt = dayjs(booking.createdAt);
            const now = dayjs();
            const minutesSinceBooking = now.diff(bookingCreatedAt, 'minute');

            console.log(`Booking created at: ${bookingCreatedAt.format()}`);
            console.log(`Current time: ${now.format()}`);
            console.log(`Minutes since booking: ${minutesSinceBooking}`);

            let refundAmount = 0;
            let refundPercentage = 0;

            // Determine refund amount based on cancellation time
            if (minutesSinceBooking <= 30) {
                // Cancel within 30 minutes - 80% refund
                refundAmount = booking.booking_fee * 0.8;
                refundPercentage = 80;
            } else {
                // Cancel after 30 minutes - 50% refund
                refundAmount = booking.booking_fee * 0.5;
                refundPercentage = 50;
            }

            // Round to 2 decimal places
            refundAmount = Math.round(refundAmount * 100) / 100;

            console.log(`Booking fee: ${booking.booking_fee}`);
            console.log(`Refund amount: ${refundAmount}`);
            console.log(`Refund percentage: ${refundPercentage}%`);

            // Update booking status
            booking.status = 'cancelled';
            booking.cancelled_at = new Date();
            booking.cancelled_by_type = 'EvOwner';
            booking.cancelled_by_id = ev_user_id;
            booking.cancellation_reason = `Cancelled by EV owner - ${refundPercentage}% refund applied`;

            await booking.save({ session });

            // Process refund if applicable
            if (refundAmount > 0) {
                // Find the original transaction to get station owner info
                const originalTransaction = await mongoose.model('Transaction').findOne({
                    booking_id: booking_id,
                    type: 'booking_charge',
                    status: 'completed'
                }).session(session);

                if (!originalTransaction) {
                    throw new Error('Original booking transaction not found');
                }

                // Get station owner ID from station earnings
                const stationEarning = await mongoose.model('StationEarnings').findOne({
                    booking_id: booking_id,
                    type: 'booking_fee'
                }).session(session);

                if (!stationEarning) {
                    throw new Error('Station earning record not found');
                }

                // Process refund through wallet service (without nested transaction)
                const wallet = await Wallet.findOne({ ev_owner_id: ev_user_id }).session(session);
                if (!wallet) throw new Error('Wallet not found');

                const balanceBefore = wallet.balance;
                wallet.balance += refundAmount;
                await wallet.save({ session });

                const refundTransaction = new Transaction({
                    wallet_id: wallet._id,
                    ev_owner_id: ev_user_id,
                    type: 'refund_booking',
                    amount: refundAmount,
                    balance_before: balanceBefore,
                    balance_after: wallet.balance,
                    status: 'completed',
                    booking_id: booking_id,
                    payment_method: 'wallet',
                    description: `Refund for booking #${booking_id} - ${refundPercentage}% refund`
                });
                await refundTransaction.save({ session });

                // Update station earning record to reflect refund
                await mongoose.model('StationEarnings').findOneAndUpdate(
                    { booking_id: booking_id },
                    {
                        $set: {
                            payout_status: 'on_hold',
                            'metadata.refunded': true,
                            'metadata.reason': `Cancelled by EV owner - ${refundPercentage}% refund`,
                            'metadata.refund_amount': refundAmount,
                            'metadata.original_amount': booking.booking_fee,
                            'metadata.refund_percentage': refundPercentage,
                            'metadata.refunded_at': new Date(),
                            'metadata.cancelled_by': 'EvOwner',
                            'metadata.cancellation_time_minutes': minutesSinceBooking
                        }
                    },
                    { session }
                );
            }

            await session.commitTransaction();
            console.log(`Booking cancellation completed successfully for booking ${booking_id}`);

            res.status(200).json({
                success: true,
                message: `Booking cancelled successfully. ${refundPercentage}% refund processed.`,
                data: {
                    booking_id: booking._id,
                    original_booking_fee: booking.booking_fee,
                    refund_amount: refundAmount,
                    refund_percentage: refundPercentage,
                    cancellation_time: booking.cancelled_at,
                    minutes_after_booking: minutesSinceBooking,
                    new_wallet_balance: refundAmount > 0 ? (await Wallet.findOne({ ev_owner_id: ev_user_id })).balance : undefined
                }
            });

            return; // Success, exit the function

        } catch (error) {
            await session.abortTransaction();
            
            if (error.message.includes('WriteConflict') && retryCount < MAX_RETRIES - 1) {
                retryCount++;
                console.log(`Write conflict detected in cancellation, retrying... (${retryCount}/${MAX_RETRIES})`);
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
                continue;
            }
            
            console.error(`Cancellation failed after ${retryCount + 1} attempts:`, error);
            
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to cancel booking. Please try again.',
                retry_count: retryCount + 1
            });
            return;
        } finally {
            session.endSession();
        }
    }
});

const getAllUpcomingBookingSessions = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let { ev_user_id } = req.query;

    if (!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)) {
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }
    ev_user_id = new mongoose.Types.ObjectId(ev_user_id);

    // Get today's date at midnight in IST
    const todayIST = dayjs().tz('Asia/Kolkata').startOf('day');
    console.log('Today (IST midnight):', todayIST.format());

    let upcomingSessions = await Booking.find({
        ev_user_id,
        booking_date: { $gte: todayIST.toDate() }, // Get bookings from today onwards
        status: { $in: ['upcoming', 'completed'] } // Include both upcoming and completed sessions from today onwards
    })
        .sort({ booking_date: 1, start_time: 1 }) // Sort by date and start time ascending
        .populate({
            path: 'charging_station_id',
            populate: {
                path: 'chargers.connector_types.connector',
                model: 'connector'
            }
        })
        .populate({
            path: 'ev_user_id',
            populate: [
                {
                    path: 'vehicles.make',
                    model: 'vehiclemake'
                },
                {
                    path: 'vehicles.model',
                    model: 'vehiclemodel'
                }
            ]
        });

    if (upcomingSessions.length === 0) {
        return res.json({ message: 'No upcoming booking sessions' });
    }

    upcomingSessions = upcomingSessions.map(booking => {
        const station = booking.charging_station_id;
        const charger = station?.chargers.id(booking.charger_id);
        const connector = charger?.connector_types.id(booking.connector_type_id);
        const vehicle = booking.ev_user_id?.vehicles.id(booking.vehicle_id);

        return {
            ...booking.toObject?.() ?? booking,
            charger,
            connector: connector?.connector,
            vehicle,
            dateLabel: dayjs(booking.booking_date).format('MMM D, YYYY'),
            duration: formatDuration(booking.no_of_slots * slot_size),
            startTime: dayjs.utc(booking.start_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
            endTime: dayjs.utc(booking.end_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
        };
    });

    console.log('Upcoming sessions count:', upcomingSessions.length);
    return res.status(200).json(upcomingSessions);
});

const getUserCancelledBookings = asyncHandler(async (req, res) => {
    console.log('req: ', req.query);
    let { ev_user_id } = req.query;

    if (!ev_user_id || !mongoose.Types.ObjectId.isValid(ev_user_id)) {
        return res.status(400).json({ message: 'Invalid EV user ID' });
    }
    ev_user_id = new mongoose.Types.ObjectId(ev_user_id);

    console.log('ev_user_id: ', ev_user_id);

    let cancelledBookings = await Booking.find({
        ev_user_id,
        status: 'cancelled'
    })
        .populate({
            path: 'charging_station_id',
            populate: {
                path: 'chargers.connector_types.connector',
                model: 'connector'
            }
        })
        .populate({
            path: 'ev_user_id',
            populate: {
                path: 'vehicles.make',
                model: 'vehiclemake'
            }
        })
        .populate({
            path: 'ev_user_id',
            populate: {
                path: 'vehicles.model',
                model: 'vehiclemodel'
            }
        })
        .sort({ cancelled_at: -1 }); // Sort by cancellation date, most recent first

    console.log('cancelledBookings: ', cancelledBookings);

    if (cancelledBookings.length === 0) {
        return res.json({ message: 'No cancelled bookings' });
    }

    cancelledBookings = cancelledBookings.map(booking => {
        const station = booking.charging_station_id;
        const charger = station?.chargers.id(booking.charger_id);
        const connector = charger?.connector_types.id(booking.connector_type_id);
        const vehicle = booking.ev_user_id?.vehicles.id(booking.vehicle_id);

        // Calculate refund information
        let refundInfo = {
            percentage: 0,
            amount: 0,
            message: 'No refund'
        };

        if (booking.cancelled_at && booking.createdAt) {
            const bookingCreatedAt = dayjs(booking.createdAt);
            const cancelledAt = dayjs(booking.cancelled_at);
            const minutesSinceBooking = cancelledAt.diff(bookingCreatedAt, 'minute');

            if (minutesSinceBooking <= 30) {
                refundInfo.percentage = 80;
                refundInfo.amount = booking.booking_fee * 0.8;
                refundInfo.message = '80% refund (within 30 minutes)';
            } else {
                refundInfo.percentage = 50;
                refundInfo.amount = booking.booking_fee * 0.5;
                refundInfo.message = '50% refund (after 30 minutes)';
            }

            // Round to 2 decimal places
            refundInfo.amount = Math.round(refundInfo.amount * 100) / 100;
        }

        return {
            ...booking.toObject?.() ?? booking,
            charger,
            connector: connector?.connector,
            vehicle,
            dateLabel: dayjs(booking.booking_date).format('MMM D, YYYY'),
            duration: formatDuration(booking.no_of_slots * slot_size),
            startTime: dayjs.utc(booking.start_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
            endTime: dayjs.utc(booking.end_time).add(5, 'hour').add(30, 'minute').format('h:mm A'),
            cancelledAt: dayjs(booking.cancelled_at).format('MMM D, YYYY h:mm A'),
            refundInfo: refundInfo,
            cancellationReason: booking.cancellation_reason || 'Cancelled by user'
        }
    });

    console.log('Processed cancelledBookings: ', cancelledBookings);
    return res.status(200).json(cancelledBookings);
});
module.exports = {
    addBooking,
    getBookedSlots,
    getUserUpcomingBookings,
    getUserCompletedBookings,
    getUserCancelledBookings,
    getOwnedVehicles,
    getFavouritePartneredStations,
    getConnectorsByStation,
    cancelBookingByEvOwner,
    getAllUpcomingBookingSessions,
};