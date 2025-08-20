const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');

const getAdminRequests = asyncHandler(async (req, res) => {
    try {
        // 1. Fetch all stations with populated data
        const allStations = await PartneredChargingStation.find({
            'chargers.charger_status': {
                $in: ['processing', 'to_be_installed', 'rejected']
            }
        })
            .populate('station_owner_id', 'name email phone')
            .populate('district', 'name')
            .populate({
                path: 'chargers',
                populate: {
                    path: 'connector_types.connector',
                    select: 'type_name',
                    model: 'connector'
                }
            })
            .lean();

        // 2. Process each charger with the specified statuses
        const chargerRequests = [];
        
        allStations.forEach(station => {
            // Filter chargers with the statuses we care about
            const relevantChargers = (station.chargers || []).filter(charger => 
                charger && ['processing', 'to_be_installed', 'rejected'].includes(charger.charger_status)
            );

            // Determine if owner is new user
            const isNewUser = (station.chargers || []).every(charger => 
                charger && ['processing', 'to_be_installed', 'rejected'].includes(charger.charger_status)
            );

            // Create a request entry for each relevant charger
            relevantChargers.forEach(charger => {

                const chargerId = charger._id ? charger._id.toString() : 
                                `${station._id}-${Math.random().toString(36).substr(2, 9)}`;
                
                const connectorTypes = charger.connector_types?.map(ct => {
                    // With the new populate, ct.connector will be populated with type_name
                    if (ct?.connector && typeof ct.connector === 'object') {
                        return ct.connector.type_name || 'N/A';
                    }
                    return 'N/A';
                }).filter(Boolean) || [];
                
                const uniqueConnectorTypes = [...new Set(connectorTypes)];

                chargerRequests.push({
                    id: chargerId,
                    stationId: station._id.toString(),
                    userName: station.station_owner_id?.name || 'Unknown',
                    stationType: isNewUser ? 'New Station' : 'Existing Station',
                    status: charger.charger_status.toUpperCase(),
                    stationName: station.station_name || 'Unnamed Station',
                    stationAddress: station.address || 'Address not provided',
                    powerType: charger.power_type || 'Unknown',
                    power: charger.max_power_output || 'N/A',
                    district: station.district?.name || 'Unknown',
                    connectorType: uniqueConnectorTypes.join(', ') || 'N/A',
                    chargersRequested: '1', // Each card represents one charger
                    date: charger.createdAt?.toLocaleString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) || 'Date not available',
                    chargerData: charger // Include full charger data if needed
                });
            });
        });

        res.status(200).json({
            success: true,
            data: chargerRequests
        });

    } catch (error) {
        console.error('Error fetching admin requests:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching requests data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getRequestDetails = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the request with populated data
        const request = await PartneredChargingStation.findById(id)
            .populate('station_owner_id', 'name email phone account_status createdAt')
            .populate('district', 'name')
            .populate('chargers.connector_types', 'type_name')
            .lean();

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            });
        }
        // Determine if this is a station or connector request
        const type = request.station_status === 'in-progress' ? 'station' : 'connector';

        // Format the response
        const response = {
            id: request._id.toString(),
            type,
            title: type === 'connector' ? 'New Charger' : 'New Charging Station',
            stationName: request.station_name,
            address: request.address,
            status: request.request_status === 'processing' ? 'NEW' :
                request.request_status === 'rejected' ? 'REJECTED' : 'IN-PROGRESS',
            requester: request.station_owner_id.name || 'Unknown',
            requesterStatus: request.station_owner_id.account_status || 'Active',
            contactPerson: request.contact_person || 'Not specified',
            contactNumber: request.contact_number || 'Not specified',
            company: request.company || 'Not specified',
            date: request.createdAt.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }),
            email: request.station_owner_id.email,
            operator: request.operator || 'Not specified',
            district: request.district?.name || 'Unknown',
            businessRegNo: request.business_reg_no || 'Not specified',
            taxId: request.tax_id || 'Not specified',
            location: request.location || 'Not specified',
            chargersPlanned: request.chargers?.length.toString() || '0',
            chargers: request.chargers?.map(charger => ({
                name: charger.charger_name,
                ports: charger.connector_types?.map(ct => ct.type_name) || [],
                power: `${charger.max_power_output} kW`,
                price: `LKR ${charger.price_per_kwh || '0.00'}`
            })) || [],
            existingChargers: type === 'connector' ?
                await getExistingChargers(request.station_owner_id._id, request._id) : []
        };

        res.status(200).json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('Error fetching request details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching request details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Helper function to get existing chargers for a station owner
const getExistingChargers = async (ownerId, excludeStationId) => {
    const stations = await PartneredChargingStation.find({
        station_owner_id: ownerId,
        _id: { $ne: excludeStationId },
        station_status: { $ne: 'in-progress' }
    }).populate('chargers.connector_types', 'name');

    return stations.flatMap(station =>
        station.chargers?.map(charger => ({
            name: charger.charger_name,
            ports: charger.connector_types?.map(ct => ct.name) || [],
            power: `${charger.max_power_output} kW`,
            price: `LKR ${charger.price_per_kwh || '0.00'}`
        })) || []
    );
};

const updateRequestStatus = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        // Validate action
        if (!['approve', 'complete', 'discard'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action'
            });
        }

        // Find the request
        const request = await PartneredChargingStation.findById(id);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            });
        }

        // Handle different actions
        switch (action) {
            case 'approve':
                if (request.request_status !== 'processing') {
                    return res.status(400).json({
                        success: false,
                        message: 'Request is not in processing state'
                    });
                }
                request.request_status = 'approved';
                request.station_status = 'in-progress';
                break;

            case 'complete':
                if (request.request_status !== 'approved') {
                    return res.status(400).json({
                        success: false,
                        message: 'Request must be approved first'
                    });
                }
                request.request_status = 'finished';
                request.station_status = 'active';
                break;

            case 'discard':
                request.request_status = 'rejected';
                request.station_status = 'rejected';
                if (req.body.reason) {
                    request.rejection_reason = req.body.reason;
                }
                break;

            default:
                break;
        }

        await request.save();

        res.status(200).json({
            success: true,
            data: request
        });

    } catch (error) {
        console.error('Error updating request status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating request status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = {
    getAdminRequests,
    getRequestDetails,
    updateRequestStatus
}