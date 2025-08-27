const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');

const getAdminRequests = asyncHandler(async (req, res) => {
    try {
        // 1. Fetch all stations with populated data
<<<<<<< HEAD
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

                const chargerId = charger._id;
                
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
=======
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
            // Updated logic: station if in-progress OR both statuses are rejected
            const type = (station.station_status === 'in-progress' || 
                         (station.station_status === 'rejected' && station.request_status === 'rejected')) 
                         ? 'station' : 'connector';

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
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
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

<<<<<<< HEAD
// const getRequestDetails = asyncHandler(async (req, res) => {
//     try {
//         const { id } = req.params;

//         // Fetch the request with populated data
//         const request = await PartneredChargingStation.findById(id)
//             .populate('station_owner_id', 'name email phone account_status createdAt')
//             .populate('district', 'name')
//             .populate('chargers.connector_types', 'type_name')
//             .lean();

//         if (!request) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Request not found'
//             });
//         }
//         // Determine if this is a station or connector request
//         const type = request.station_status === 'in-progress' ? 'station' : 'connector';

//         // Format the response
//         const response = {
//             id: request._id.toString(),
//             type,
//             title: type === 'connector' ? 'New Charger' : 'New Charging Station',
//             stationName: request.station_name,
//             address: request.address,
//             status: request.request_status === 'processing' ? 'NEW' :
//                 request.request_status === 'rejected' ? 'REJECTED' : 'IN-PROGRESS',
//             requester: request.station_owner_id.name || 'Unknown',
//             requesterStatus: request.station_owner_id.account_status || 'Active',
//             contactPerson: request.contact_person || 'Not specified',
//             contactNumber: request.contact_number || 'Not specified',
//             company: request.company || 'Not specified',
//             date: request.createdAt.toLocaleDateString('en-US', {
//                 day: 'numeric',
//                 month: 'short',
//                 year: 'numeric'
//             }),
//             email: request.station_owner_id.email,
//             operator: request.operator || 'Not specified',
//             district: request.district?.name || 'Unknown',
//             businessRegNo: request.business_reg_no || 'Not specified',
//             taxId: request.tax_id || 'Not specified',
//             location: request.location || 'Not specified',
//             chargersPlanned: request.chargers?.length.toString() || '0',
//             chargers: request.chargers?.map(charger => ({
//                 name: charger.charger_name,
//                 ports: charger.connector_types?.map(ct => ct.type_name) || [],
//                 power: `${charger.max_power_output} kW`,
//                 price: `LKR ${charger.price_per_kwh || '0.00'}`
//             })) || [],
//             existingChargers: type === 'connector' ?
//                 await getExistingChargers(request.station_owner_id._id, request._id) : []
//         };

//         res.status(200).json({
//             success: true,
//             data: response
//         });

//     } catch (error) {
//         console.error('Error fetching request details:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching request details',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// });

=======
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
const getRequestDetails = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

<<<<<<< HEAD
        // Find station that contains this charger
        const station = await PartneredChargingStation.findOne({
            'chargers._id': id
        })
            .populate('station_owner_id', 'name email phone account_status createdAt businessName businessRegistrationNumber')
            .populate('district', 'name')
            .populate({
                path: 'chargers',
                populate: {
                    path: 'connector_types.connector',
                    select: 'type_name',
                    model: 'connector'
                }
            })
            // .populate('chargers.connector_types.connector', 'type_name')
            .lean();

        if (!station) {
=======
        // Fetch the request with populated data
        const request = await PartneredChargingStation.findById(id)
            .populate('station_owner_id', 'name email phone account_status createdAt')
            .populate('district', 'name')
            .populate('chargers.connector_types', 'type_name')
            .lean();

        if (!request) {
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            });
        }
<<<<<<< HEAD

        // Categorize chargers
        const newChargers = station.chargers.filter(c => 
            ['processing', 'to_be_installed', 'rejected'].includes(c.charger_status)
        );
        
        const existingChargers = station.chargers.filter(c => 
            ['open', 'unavailable', 'disabled_by_SO', 'deleted'].includes(c.charger_status)
        );

        // Determine station status
        const allChargersNew = station.chargers.every(c => 
            ['processing', 'to_be_installed', 'rejected'].includes(c.charger_status)
        );
        
        const stationStatus = allChargersNew ? 'New Station' : station.station_status;

        // Helper function to extract connector names
        const extractConnectorNames = (connectorTypes) => {
            if (!Array.isArray(connectorTypes)) return [];
            
            return connectorTypes
                .map(ct => {
                    // If connector is populated, it will be an object with type_name
                    if (ct.connector && typeof ct.connector === 'object') {
                        return ct.connector.type_name;
                    }
                    // If it's just an ID string, we can't get the name here
                    return 'N/A';
                })
                .filter(Boolean);
        };

        // Format response
        const response = {
            id: station._id.toString(),
            title: 'Charger Request Details',
            stationStatus,
            stationName: station.station_name,
            stationOwner: station.station_owner_id.name || 'Unknown',
            ownerAccountStatus: station.station_owner_id.account_status || 'N/A',
            ownerRegisteredOn: station.station_owner_id.createdAt.toLocaleString('en-US', {
=======
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
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }),
<<<<<<< HEAD
            email: station.station_owner_id.email || 'N/A',
            address: station.address,
            city: station.city,
            district: station.district?.name || 'N/A',
            businessRegNo: station.station_owner_id.businessRegistrationNumber || 'N/A',
            businessName: station.station_owner_id.businessName || 'N/A',
            electricityProvider: station.electricity_provider,
            powerSource: station.power_source,
            newChargers: newChargers.map(c => ({
                _id: c._id.toString(),
                name: c.charger_name,
                powerType: c.power_type,
                maxPower: c.max_power_output,
                price: c.price,
                status: c.charger_status,
                rejectionReason: c.rejection_reason,
                connectors: extractConnectorNames(c.connector_types),
                createdAt: c.createdAt
            })),
            existingChargers: existingChargers.map(c => ({
                _id: c._id.toString(),
                name: c.charger_name,
                powerType: c.power_type,
                maxPower: c.max_power_output,
                price: c.price,
                status: c.charger_status,
                connectors: extractConnectorNames(c.connector_types),
                createdAt: c.createdAt
            }))
=======
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
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
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

<<<<<<< HEAD

// const updateRequestStatus = asyncHandler(async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { action } = req.body;

//         // Validate action
//         if (!['approve', 'complete', 'discard'].includes(action)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid action'
//             });
//         }

//         // Find the request
//         const request = await PartneredChargingStation.findById(id);
//         if (!request) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Request not found'
//             });
//         }

//         // Handle different actions
//         switch (action) {
//             case 'approve':
//                 if (request.request_status !== 'processing') {
//                     return res.status(400).json({
//                         success: false,
//                         message: 'Request is not in processing state'
//                     });
//                 }
//                 request.request_status = 'approved';
//                 request.station_status = 'in-progress';
//                 break;

//             case 'complete':
//                 if (request.request_status !== 'approved') {
//                     return res.status(400).json({
//                         success: false,
//                         message: 'Request must be approved first'
//                     });
//                 }
//                 request.request_status = 'finished';
//                 request.station_status = 'active';
//                 break;

//             case 'discard':
//                 request.request_status = 'rejected';
//                 request.station_status = 'rejected';
//                 if (req.body.reason) {
//                     request.rejection_reason = req.body.reason;
//                 }
//                 break;

//             default:
//                 break;
//         }

//         await request.save();

//         res.status(200).json({
//             success: true,
//             data: request
//         });

//     } catch (error) {
//         console.error('Error updating request status:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error updating request status',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     }
// });

const updateRequestStatus = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason, chargerId } = req.body;

        // Validate action
        if (!['approve', 'decline', 'complete-installation'].includes(action)) {
=======
const updateRequestStatus = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        // Validate action
        if (!['approve', 'complete', 'discard'].includes(action)) {
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
            return res.status(400).json({
                success: false,
                message: 'Invalid action'
            });
        }

<<<<<<< HEAD
        // Validate reason for decline action
        if (action === 'decline' && (!reason || typeof reason !== 'string' || reason.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: 'Reason is required for declining a request'
            });
        }

        let request;
        
        // Check if it's a charger ID or station ID
        if (chargerId) {
            // Update specific charger status
            request = await PartneredChargingStation.findOne({
                'chargers._id': chargerId
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: 'Charger not found'
                });
            }

            const charger = request.chargers.id(chargerId);
            if (!charger) {
                return res.status(404).json({
                    success: false,
                    message: 'Charger not found'
                });
            }

            switch (action) {
                case 'approve':
                    if (charger.charger_status !== 'processing') {
                        return res.status(400).json({
                            success: false,
                            message: 'Charger is not in processing state'
                        });
                    }
                    charger.charger_status = 'to_be_installed';
                    break;

                case 'decline':
                    if (charger.charger_status !== 'processing') {
                        return res.status(400).json({
                            success: false,
                            message: 'Charger is not in processing state'
                        });
                    }
                    charger.charger_status = 'rejected';
                    if (reason) {
                        charger.rejection_reason = reason;
                    }
                    break;

                case 'complete-installation':
                    if (charger.charger_status !== 'to_be_installed') {
                        return res.status(400).json({
                            success: false,
                            message: 'Charger must be in to-be-installed state first'
                        });
                    }
                    charger.charger_status = 'open';
                    const otherChargers = request.chargers.filter(c => c._id.toString() !== chargerId);
                    const allOtherChargersPending = otherChargers.every(c =>
                        ['processing', 'to_be_installed', 'rejected'].includes(c.charger_status)
                    );
                    if (allOtherChargersPending && request.station_status !== 'open') {
                        request.station_status = 'open';
                    }
                    break;

                default:
                    break;
            }

        } 
        // else {
        //     // Update station status (for backward compatibility)
        //     request = await PartneredChargingStation.findById(id);
            
        //     if (!request) {
        //         return res.status(404).json({
        //             success: false,
        //             message: 'Request not found'
        //         });
        //     }

        //     // Handle station-level actions if needed
        //     switch (action) {
        //         case 'approve':
        //             if (request.request_status !== 'processing') {
        //                 return res.status(400).json({
        //                     success: false,
        //                     message: 'Request is not in processing state'
        //                 });
        //             }
        //             request.request_status = 'approved';
        //             request.station_status = 'in-progress';
        //             break;

        //         case 'complete':
        //             if (request.request_status !== 'approved') {
        //                 return res.status(400).json({
        //                     success: false,
        //                     message: 'Request must be approved first'
        //                 });
        //             }
        //             request.request_status = 'finished';
        //             request.station_status = 'active';
        //             break;

        //         case 'decline':
        //             request.request_status = 'rejected';
        //             request.station_status = 'rejected';
        //             if (reason) {
        //                 request.rejection_reason = reason;
        //             }
        //             break;

        //         default:
        //             break;
        //     }
        // }

        await request.save();

        // Populate the updated document before returning
        const updatedRequest = await PartneredChargingStation.findById(request._id)
            .populate('station_owner_id', 'name email phone account_status createdAt')
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

        res.status(200).json({
            success: true,
            data: updatedRequest
=======
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
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00
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