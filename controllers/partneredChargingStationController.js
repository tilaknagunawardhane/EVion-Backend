const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');

const checkStationsExist = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.body; // Only need userId since email isn't used
        
        // Verify station owner exists
        const owner = await StationOwner.findById(userId);
        if (!owner) {
            return res.status(400).json({ 
                success: false,
                message: 'Station Owner not found' 
            });
        }

        // Check station count
        const stationCount = await PartneredChargingStation.countDocuments({ 
            station_owner_id: userId 
        });
        console.log('no of stations: ', stationCount);
        
        res.status(200).json({
            success: true,
            hasStations: stationCount > 0,
            stationCount // Optional: include actual count
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


module.exports = {
    checkStationsExist
}