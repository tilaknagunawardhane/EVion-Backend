const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const EvOwner = require('../models/evOwnerModel');
const StationReport = require('../models/stationReportModel');

const submitStationReport = asyncHandler(async (req, res) => {
    const { userId, stationId, category, description, attachments = [] } = req.body;

    // Validate required fields
    if (!userId || !stationId || !category || !description) {
        return res.status(400).json({
            success: false,
            message: 'User ID, Station ID, Category, and Description are required'
        });
    }

    // Check if the user exists
    const user = await EvOwner.findById(userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    const station = await PartneredChargingStation.findById(stationId);
    if (!station) {
        return res.status(404).json({
            success: false,
            message: 'Charging station not found'
        });
    }

    if (attachments && attachments.length > 5) {
        return res.status(400).json({
            success: false,
            message: 'Maximum 5 attachments allowed'
        });
    }

    // Create the report
    const report = new StationReport({
        user_id: userId,
        station_id: stationId,
        category,
        description,
        attachments: attachments || [],
        status: 'under-review'
    });
    await report.save();

    res.status(201).json({
        success: true,
        message: 'Report submitted successfully',
        report
    });
});

module.exports = {
    submitStationReport
}