const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');

const checkStationsExist = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.body;

        // 1. Verify station owner exists
        const owner = await StationOwner.findById(userId);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: 'Station owner not found'
            });
        }

        // 2. Get all stations for this owner
        const stations = await PartneredChargingStation.find({
            station_owner_id: userId
        }).select('request_status station_status');

        // 3. Check conditions
        const hasApprovedStation = stations.some(
            station => station.request_status === 'approved'
        );
        const totalStations = stations.length;

        res.status(200).json({
            success: true,
            hasStations: totalStations > 0,
            hasApprovedStation,
            totalStations,
            stations // Optional: include station details if needed
        });

    } catch (error) {
        console.error('Station check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking stations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const createStation = asyncHandler(async (req, res) => {
    try {
        const { stationOwnerID, ...stationData } = req.body;
        //  console.log('Received data:', { stationOwnerID, stationData });
        // console.log('req.body : ', req.body)
        const owner = await StationOwner.findById(stationOwnerID);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: 'Station owner not found'
            });
        }

        // Check if owner has too many pending stations
        const pendingCount = await PartneredChargingStation.countDocuments({
            station_owner_id: stationOwnerID,
            request_status: 'processing'
        });

        if (pendingCount >= 5) { // Adjust limit as needed
            return res.status(400).json({
                success: false,
                message: 'You have too many pending station requests'
            });
        }

        // Create station
        const stationDataAll = {
            station_owner_id: stationOwnerID,
            ...stationData
        };

        const newStation = await PartneredChargingStation.create(stationDataAll);
        res.status(201).json({
            success: true,
            message: 'Station request submitted successfully',
            data: newStation
        });

    } catch (error) {
        console.error('Station creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
})



module.exports = {
    checkStationsExist,
    createStation
}