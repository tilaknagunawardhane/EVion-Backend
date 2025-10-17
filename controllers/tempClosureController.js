const asyncHandler = require('express-async-handler');
const TemporaryClosure = require('../models/temporaryClosureModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel'); 

const createTemporaryClosure = asyncHandler(async (req, res) => {
    const { stationId } = req.params;
    const { owner_id, fromDateTime, toDateTime, reason } = req.body;

    if (!fromDateTime || !toDateTime || !reason || !owner_id) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Convert date strings to Date objects (Mongoose handles this automatically, but good practice)
    const newClosure = await TemporaryClosure.create({
        station_id: stationId,
        owner_id: owner_id,
        from_date_time: new Date(fromDateTime),
        to_date_time: new Date(toDateTime),
        reason: reason,
        status: new Date(fromDateTime) <= new Date() ? 'active' : 'pending' 
        // If the closure starts immediately, set status to 'active'.
        // Otherwise, it starts as 'pending' until a scheduled task activates it.
    });
    
    if (newClosure.status === 'active') {
        await PartneredChargingStation.findByIdAndUpdate(stationId, { station_status: 'unavailable' });
    }

    res.status(201).json({ 
        success: true, 
        message: 'Temporary closure recorded.', 
        data: newClosure 
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