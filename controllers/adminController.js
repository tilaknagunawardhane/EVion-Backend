const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');

const getAdminRequests = asyncHandler(async (req, res) => {
    try {
        // 1. Fetch all stations with populated data
        const allStations = await PartneredChargingStation.find()
            .populate('station_owner_id', 'name email phone')
            .populate('district', 'name')
            .populate('chargers.connector_types', 'name')
            .lean();

        // 2. First get all unique owner IDs
        const ownerIds = [...new Set(allStations
            .map(s => s.station_owner_id?._id?.toString())
            .filter(Boolean))];

        // 3. Fetch all stations for each owner to determine new/existing status
        const ownerStatuses = {};
        await Promise.all(ownerIds.map(async ownerId => {
            const ownerStations = await PartneredChargingStation.find({
                station_owner_id: ownerId
            }).lean();

            const isNewUser = ownerStations.every(s => s.station_status === 'in-progress');
            ownerStatuses[ownerId] = isNewUser;
        }));

        // 4. Process each station with the correct user type
        const processedRequests = allStations.map(station => {
            const ownerId = station.station_owner_id?._id?.toString();
            const isNewUser = ownerId ? ownerStatuses[ownerId] : false;

            // Determine the tab (stations or connectors)
            const type = station.station_status === 'in-progress' ? 'station' : 'connector';

            // Determine the status section (NEW, IN-PROGRESS, REJECTED)
            let status;
            if (station.request_status === 'processing') status = 'NEW';
            else if (station.request_status === 'rejected') status = 'REJECTED';
            else status = 'IN-PROGRESS'; // approved or to-be-installed

            // Safely handle chargers data
            const chargersCount = station.chargers?.length || 0;
            const connectorTypes = station.chargers?.flatMap(charger =>
                charger.connector_types?.map(ct => ct?.name).filter(Boolean) || []);
            const uniqueConnectorTypes = [...new Set(connectorTypes)];

            return {
                id: station._id.toString(),
                type,
                userName: station.station_owner_id?.name || 'Unknown',
                userType: isNewUser ? 'New User' : 'Existing User',
                status,
                stationName: station.station_name || 'Unnamed Station',
                stationAddress: station.address || 'Address not provided',
                district: station.district?.name || 'Unknown',
                connectorType: uniqueConnectorTypes.join(', ') || 'N/A',
                chargersRequested: chargersCount.toString(),
                date: station.createdAt?.toLocaleString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                }) || 'Date not available'
            };
        });

        // Separate into stations and connectors
        const stationRequests = processedRequests.filter(r => r.type === 'station');
        const connectorRequests = processedRequests.filter(r => r.type === 'connector');

        res.status(200).json({
            success: true,
            data: {
                stationRequests,
                connectorRequests
            }
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

module.exports = {
    getAdminRequests,
    getRequestDetails,
}