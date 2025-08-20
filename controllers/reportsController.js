const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const EvOwner = require('../models/evOwnerModel');
const StationReport = require('../models/stationReportModel');
const ChargerReport = require('../models/chargerReportModel');

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

const submitChargerReport = asyncHandler(async (req, res) => {
    const { userId, stationId, chargerId, connectorId, category, description, attachments = [] } = req.body;
    console.log('Received data:', req.body);

    // Validate required fields
    if (!userId || !stationId || !chargerId || !connectorId || !category || !description) {
        return res.status(400).json({
            success: false,
            message: 'User ID, Station ID, Charger ID, Connector ID, Category, and Description are required'
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

    // Check if station exists
    const station = await PartneredChargingStation.findById(stationId);
    if (!station) {
        return res.status(404).json({
            success: false,
            message: 'Charging station not found'
        });
    }

    // Check if charger exists in the station
    const chargerExists = station.chargers.id(chargerId);
    if (!chargerExists) {
        return res.status(404).json({
            success: false,
            message: 'Charger not found in this station'
        });
    }

    // Check if connector exists in the charger
    const connectorExists = chargerExists.connector_types.id(connectorId);
    if (!connectorExists) {
        return res.status(404).json({
            success: false,
            message: 'Connector not found in this charger'
        });
    }
const trimmedDescription = description.trim();
    if (trimmedDescription.length > 1000) {
        return res.status(400).json({
            success: false,
            message: 'Description cannot exceed 1000 characters'
        });
    }

    // Validate attachments
    if (attachments.length > 5) {
        return res.status(400).json({
            success: false,
            message: 'Maximum 5 attachments allowed'
        });
    }

    // Create the report
    const report = new ChargerReport({
        user_id: userId,
        station_id: stationId,
        charger_id: chargerId,
        connector_id: connectorId,
        category,
        description: trimmedDescription,
        attachments: attachments,
        status: 'under-review'
    });

    await report.save();

    // Populate the report for better response
    const populatedReport = await ChargerReport.findById(report._id)
        .populate('user_id', 'name email')
        .populate('station_id', 'station_name address city')
        .lean();

    res.status(201).json({
        success: true,
        message: 'Charger report submitted successfully',
        data: populatedReport
    });
});

module.exports = {
    submitStationReport,
    submitChargerReport
}