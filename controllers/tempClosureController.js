const asyncHandler = require('express-async-handler');
const TemporaryClosure = require('../models/temporaryClosureModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const Booking = require('../models/bookingModel');
const WalletService = require('../services/walletService');
const mongoose = require('mongoose');

const createTemporaryClosure = asyncHandler(async (req, res) => {
    const { stationId } = req.params;
    const { owner_id, fromDateTime, toDateTime, reason } = req.body;
    console.log("Creating temporary closure for station:", stationId);
    console.log("Come here 1")

    const startTime = new Date(fromDateTime);
    const endTime = new Date(toDateTime);

    if (!fromDateTime || !toDateTime || !reason || !owner_id) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Find and Cancel Overlapping Bookings
    const overlappingBookings = await Booking.find({
        charging_station_id: stationId,
        status: 'upcoming',
        $and: [
            { start_time: { $lt: endTime } }, // Booking starts before closure ends
            { end_time: { $gt: startTime } }  // Closure starts before booking ends
        ]
    }).populate('ev_user_id', '_id'); // Populate EV owner ID for refunds

    const cancellationDetails = {
        status: 'cancelled',
        cancelled_at: new Date(),
        cancellation_reason: `Station closed due to: ${reason}`,
        cancelled_by_type: 'StationOwner',
        cancelled_by_id: owner_id
    };

    console.log("Come here 2")
    // Process refunds for cancelled bookings
    const refundResults = [];
    if (overlappingBookings.length > 0) {
        for (const booking of overlappingBookings) {
            try {
                // Check if this booking has already been paid for (has a booking fee)
                // You might want to add a field in your Booking model to track if booking fee was paid
                const bookingFeeAmount = booking.booking_fee || 0; // Adjust based on your booking model
                
                if (bookingFeeAmount > 0 && booking.ev_user_id) {
                    // Process refund for booking fee
                    const refundResult = await WalletService.refundBooking(
                        booking.ev_user_id._id, // EV owner ID
                        booking._id, // Booking ID
                        bookingFeeAmount, // Amount to refund
                        `Station temporary closure: ${reason}`,
                        null, // reportId if applicable,
                        owner_id // Station owner ID processing the refund
                    );
                    
                    refundResults.push({
                        bookingId: booking._id,
                        evOwnerId: booking.ev_user_id._id,
                        amount: bookingFeeAmount,
                        success: true,
                        transactionId: refundResult.transaction._id
                    });
                    
                    console.log(`Refund processed for booking ${booking._id}: LKR ${bookingFeeAmount}`);
                } else {
                    refundResults.push({
                        bookingId: booking._id,
                        evOwnerId: booking.ev_user_id?._id,
                        amount: 0,
                        success: true,
                        note: 'No booking fee to refund'
                    });
                }
            } catch (refundError) {
                console.error(`Failed to refund booking ${booking._id}:`, refundError);
                refundResults.push({
                    bookingId: booking._id,
                    evOwnerId: booking.ev_user_id?._id,
                    amount: booking.booking_fee || 0,
                    success: false,
                    error: refundError.message
                });
            }
        }

        // Update all overlapping bookings status
        await Booking.updateMany(
            { _id: { $in: overlappingBookings.map(b => b._id) } },
            { $set: cancellationDetails }
        );
        console.log(`Cancelled ${overlappingBookings.length} bookings due to station closure.`);
    }

    // Create Temporary Closure Record
    const newClosure = await TemporaryClosure.create({
        station_id: stationId,
        owner_id: owner_id,
        from_date_time: startTime,
        to_date_time: endTime,
        reason: reason,
        status: startTime <= new Date() ? 'active' : 'pending',
        metadata: {
            cancelled_bookings: overlappingBookings.length,
            refunds_processed: refundResults.filter(r => r.success).length,
            refund_details: refundResults
        }
    });
    
    // Update Station Status if necessary
    if (newClosure.status === 'active') {
        await PartneredChargingStation.findByIdAndUpdate(stationId, { station_status: 'unavailable' });
    }

    res.status(201).json({ 
        success: true, 
        message: `Temporary closure recorded. ${overlappingBookings.length} bookings cancelled. ${refundResults.filter(r => r.success).length} refunds processed.`,
        data: {
            closure: newClosure,
            cancellation_summary: {
                total_bookings: overlappingBookings.length,
                successful_refunds: refundResults.filter(r => r.success).length,
                failed_refunds: refundResults.filter(r => !r.success).length,
                refund_details: refundResults
            }
        }
    });
});

// Implement a controller to fetch all closures for a station
const getTemporaryClosures = asyncHandler(async (req, res) => {
    try {
        const { stationId } = req.params;
        // Assuming you pass the owner ID as a query parameter for authorization
        const stationOwnerID = req.query.stationOwnerId; 

        if (!stationOwnerID) {
            return res.status(400).json({ 
                success: false, 
                message: 'Station owner ID is required for authorization.' 
            });
        }

        // Find all closures for the station and ensure they belong to the correct owner
        const closures = await TemporaryClosure.find({
            station_id: stationId,
            owner_id: stationOwnerID,
            status: { $in: ['pending', 'active'] } 
        }).sort({ from_date_time: 1 });

        if (!closures || closures.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No temporary closures found for this station.',
                data: []
            });
        }

        res.status(200).json({
            success: true,
            message: 'Temporary closures fetched successfully.',
            data: closures
        });
    } catch (error) {
        console.error('Error fetching temporary closures:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching temporary closures',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const cancelTemporaryClosure = asyncHandler(async (req, res) => {
    try {
        const { stationId, closureId } = req.params;

        const stationOwnerID = req.body.stationOwnerID || req.query.stationOwnerId;

        if (!stationOwnerID) {
            return res.status(400).json({ 
                success: false, 
                message: 'Station owner ID is required for authorization.' 
            });
        }

        // 1. Find the closure and update its status to 'cancelled'
        const cancelledClosure = await TemporaryClosure.findOneAndUpdate(
            {
                _id: closureId,
                station_id: stationId,
                owner_id: stationOwnerID,
                status: { $in: ['pending', 'active'] } 
            },
            { 
                $set: { status: 'cancelled' } 
            },
            { new: true } // Return the updated document
        );

        if (!cancelledClosure) {
            return res.status(404).json({
                success: false,
                message: 'Temporary closure not found, not owned by user, or already completed/cancelled.'
            });
        }
        
        // 2. If the closure was ACTIVE, check if the station needs to be reopened
        if (cancelledClosure.status === 'active') {
            
            const otherActiveClosures = await TemporaryClosure.countDocuments({
                station_id: stationId,
                status: 'active',
                _id: { $ne: cancelledClosure._id } // Exclude the closure we just modified
            });

            // If no other closures are active, set the station back to 'open'
            if (otherActiveClosures === 0) {
                await PartneredChargingStation.findByIdAndUpdate(
                    stationId, 
                    { station_status: 'open' }
                );
                console.log(`Station ${stationId} reopened after closure cancellation.`);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Temporary closure successfully cancelled.',
            data: cancelledClosure
        });
        
    } catch (error) {
        console.error('Error cancelling temporary closure:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling temporary closure',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = { 
    createTemporaryClosure, 
    getTemporaryClosures,
    cancelTemporaryClosure
};