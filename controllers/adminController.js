const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');

// Get all admin requests
const getAdminRequests = asyncHandler(async (req, res) => {
    try {
        const stations = await PartneredChargingStation.find()
            .populate('station_owner_id', 'name email phone')
            .populate('district', 'name')
            .populate('chargers.connector_types', 'type_name')
            .lean();
        res.status(200).json({ success: true, data: stations });
    } catch (error) {
        console.error('Error fetching admin requests:', error);
        res.status(500).json({ success: false, message: 'Error fetching requests data' });
    }
});

// Get details for a specific request
const getRequestDetails = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const request = await PartneredChargingStation.findById(id)
            .populate('station_owner_id', 'name email phone account_status createdAt')
            .populate('district', 'name')
            .populate('chargers.connector_types', 'type_name')
            .lean();
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }
        res.status(200).json({ success: true, data: request });
    } catch (error) {
        console.error('Error fetching request details:', error);
        res.status(500).json({ success: false, message: 'Error fetching request details' });
    }
});

// Update request status
const updateRequestStatus = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;
        const request = await PartneredChargingStation.findById(id);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }
        switch (action) {
            case 'approve':
                request.request_status = 'approved';
                request.station_status = 'in-progress';
                break;
            case 'complete':
                request.request_status = 'finished';
                request.station_status = 'active';
                break;
            case 'discard':
                request.request_status = 'rejected';
                request.station_status = 'rejected';
                if (reason) request.rejection_reason = reason;
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid action' });
        }
        await request.save();
        res.status(200).json({ success: true, data: request });
    } catch (error) {
        console.error('Error updating request status:', error);
        res.status(500).json({ success: false, message: 'Error updating request status' });
    }
});

module.exports = {
    getAdminRequests,
    getRequestDetails,
    updateRequestStatus
};