const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');

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

module.exports = {
    getAdminRequests
}