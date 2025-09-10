const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');
const path = require('path');
const EvOwner = require('../models/evOwnerModel');
const Admin = require('../models/adminModel');
const Chat = require('../models/chatModel');
const Message = require('../models/messageModel');
const { response } = require('express');
const SupportOfficer = require('../models/supportOfficerModel')
const { notifyNewStation } = require('../middlewares/notificationMiddleware')

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
        }).select('request_status station_status chargers');

        // 3. Check conditions
        const hasApprovedStation = stations.some(station => {

            return station.chargers && station.chargers.some(charger =>
                ['open', 'unavailable', 'disabled_by_SO', 'deleted'].includes(charger.charger_status)
            );
        });

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

const sendAutoMessageToAdmin = async (stationOwnerId, stationData, actionType) => {
    try {
        const stationOwner = await StationOwner.findById(stationOwnerId);
        const admin = await Admin.findOne();
        const supportOfficer = await SupportOfficer.findOne();

        console.log('Station Owner:', stationOwner);
        console.log('Admin:', admin);
        console.log('Support Officer:', supportOfficer);

        if (!admin || !stationOwner || !supportOfficer) {
            console.log('Missing required users:', { admin: !!admin, stationOwner: !!stationOwner, supportOfficer: !!supportOfficer });
            return;
        }

        // Find or create admin chat (FIXED QUERY)
        let adminChat = await Chat.findOne({
            $and: [
                { 'participants.user_id': stationOwnerId },
                { 'participants.user_id': admin._id },
                { 'participants.role': 'stationowner' },
                { 'participants.role': 'admin' }
            ]
        });

        // Find or create support officer chat (FIXED QUERY)
        let supportChat = await Chat.findOne({
            $and: [
                { 'participants.user_id': stationOwnerId },
                { 'participants.user_id': supportOfficer._id },
                { 'participants.role': 'stationowner' },
                { 'participants.role': 'supportofficer' }
            ]
        });

        console.log('Existing admin chat:', adminChat);
        console.log('Existing support chat:', supportChat);

        // Create admin chat if it doesn't exist
        if (!adminChat) {
            adminChat = await Chat.create({
                participants: [
                    {
                        user_id: stationOwnerId,
                        role: 'stationowner',
                        modelType: 'stationowner'
                    },
                    {
                        user_id: admin._id,
                        role: 'admin',
                        modelType: 'Admin'
                    }
                ],
                topic: 'stationApproval',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('Created new admin chat:', adminChat._id);
        }

        // Create support chat if it doesn't exist
        if (!supportChat) {
            supportChat = await Chat.create({
                participants: [
                    {
                        user_id: stationOwnerId,
                        role: 'stationowner',
                        modelType: 'stationowner'
                    },
                    {
                        user_id: supportOfficer._id,
                        role: 'supportofficer',
                        modelType: 'SupportOfficer'
                    }
                ],
                topic: 'support',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('Created new support chat:', supportChat._id);
        }

        let message = '';

        if (actionType === 'station_added') {
            message = `🚗 New station "${stationData.station_name}" added by ${stationOwner.business_name || stationOwner.name}.\n\n` +
                `📍 Location: ${stationData.city}, ${stationData.district}\n\n` +
                `🔌 Chargers: ${stationData.chargers.length} charger(s) added\n\n` +
                `Please review and approve.`;
        }
        else if (actionType === 'station_updated') {
            message = `📝 Station "${stationData.station_name}" updated by ${stationOwner.business_name || stationOwner.name}.\n` +
                `Changes include station details modification.`;
        }
        else if (actionType === 'charger_added') {
            message = `🔌 New charger added to station "${stationData.station_name}" by ${stationOwner.business_name || stationOwner.name}.\n` +
                `Total chargers now: ${stationData.chargers.length}`;
        }

        // Send the auto message to ADMIN - CORRECTED seenBy
        await Message.create({
            chat_id: adminChat._id,
            sender: {
                user_id: admin._id,    // Sent by admin (system message)
                role: 'admin'
            },
            message: message,
            messageType: 'system',
            timestamp: new Date(),
            seenBy: [{ 
                userId: stationOwnerId,  // ✅ Station owner has seen this message
                seenAt: new Date() 
            }]
        });

        // Update last message in admin chat
        await Chat.findByIdAndUpdate(adminChat._id, {
            lastMessage: {
                text: message,
                senderId: admin._id,
                senderRole: 'admin',
                timestamp: new Date()
            },
            updatedAt: new Date()
        });

        console.log('Auto message sent to admin successfully');

    } catch (error) {
        console.error('Auto message error:', error);
        // Don't throw error - this is a background process
    }
};

const createStation = asyncHandler(async (req, res) => {
    try {
        const { stationOwnerID, ...stationData } = req.body;

        // Verify station owner exists
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

        if (pendingCount >= 5) {
            return res.status(400).json({
                success: false,
                message: 'You have too many pending station requests'
            });
        }

        // Check if owner has any finished stations
        const hasFinishedStation = await PartneredChargingStation.exists({
            station_owner_id: stationOwnerID,
            request_status: 'finished'
        });

        // Create station
        const newStation = await PartneredChargingStation.create({
            station_owner_id: stationOwnerID,
            ...stationData
        });

        if (newStation) {
            await sendAutoMessageToAdmin(stationOwnerID, newStation, 'station_added');
            await notifyNewStation(newStation, owner)


            console.log("Go here");
            res.status(201).json({
                success: true,
                message: 'Station request submitted successfully',
                data: newStation,
                shouldNavigateToDashboard: hasFinishedStation // Add this flag
            });
        }

    } catch (error) {
        console.error('Station creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getRequestedStations = asyncHandler(async (req, res) => {
    try {
        const { stationOwnerID } = req.body;
        // console.log('req body', req.body);
        const stations = await PartneredChargingStation.find({ station_owner_id: stationOwnerID })
            .populate('station_owner_id', 'name email')
            .populate('district', 'name')
            .populate({
                path: 'chargers.connector_types.connector',
                select: 'type_name',
                model: 'connector'
            })
            .lean();

        if (!stations || stations.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No stations found'
            });
        }

        const filteredStations = stations.filter(station => {
            // If station has no chargers, include it
            if (!station.chargers || station.chargers.length === 0) return true;

            // Check if ALL chargers don't have the excluded statuses
            return station.chargers.every(charger =>
                !['open', 'unavailable', 'disabled_by_SO', 'deleted'].includes(charger.charger_status)
            );
        });



        const transformedStations = filteredStations.map(station => {
            // Safe defaults for station
            const safeStation = {
                station_name: '',
                address: '',
                city: '',
                district: null,
                electricity_provider: '',
                power_source: '',
                chargers: [],
                ...station
            };

            // Safe processing of chargers
            const safeChargers = safeStation.chargers.map(charger => {
                const safeCharger = {
                    charger_name: 'Unnamed Charger',
                    power_type: 'Unknown',
                    max_power_output: 0,
                    connector_types: [],
                    charger_status: 'processing',
                    ...charger
                };

                const connectors = Array.isArray(safeCharger.connector_types)
                    ? safeCharger.connector_types
                        .filter(ct => ct?.connector) // Filter out null connectors
                        .map(ct => {
                            // Check if connector is populated (object) or just ID (string)
                            if (typeof ct.connector === 'object' && ct.connector.type_name) {
                                return ct.connector.type_name;
                            }
                            return 'Unknown';
                        })
                    : [];


                return {
                    name: safeCharger.charger_name,
                    powerType: safeCharger.power_type,
                    maxPower: safeCharger.max_power_output,
                    price: safeCharger.price || 'N/A',
                    status: safeCharger.charger_status,
                    connectors: connectors.filter(Boolean)
                };
            });

            return {
                _id: safeStation._id,
                name: safeStation.station_name,
                // status: safeStation.request_status,
                address: safeStation.address,
                city: safeStation.city,
                district: safeStation.district?.name || 'Unknown',
                powerTypes: [...new Set(safeChargers.map(c => c.powerType))],
                electricityProvider: safeStation.electricity_provider,
                powerSource: safeStation.power_source,
                numChargers: safeChargers.length,
                chargers: safeChargers
            };
        });

        // console.log('Successfully fetched stations:', transformedStations.length);

        res.status(200).json({
            success: true,
            data: transformedStations
        });

    } catch (error) {
        console.error('Error fetching stations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
})

// Add to station.controller.js
const deleteStation = asyncHandler(async (req, res) => {
    try {
        const { stationOwnerID } = req.body;
        console.log(stationOwnerID);
        console.log(req.params.id);
        const station = await PartneredChargingStation.findOneAndDelete({
            _id: req.params.id,
            station_owner_id: stationOwnerID
        });

        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found or not owned by user'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Station deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting station:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get station data for editing
const getStationForEdit = asyncHandler(async (req, res) => {
    try {
        const { stationOwnerID } = req.body;
        console.log('owner', stationOwnerID);
        const station = await PartneredChargingStation.findOne({
            _id: req.params.id,
            station_owner_id: stationOwnerID
        });

        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found or not owned by user'
            });
        }

        res.status(200).json({
            success: true,
            data: station
        });
    } catch (error) {
        console.error('Error fetching station for edit:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching station data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update station
const updateStation = asyncHandler(async (req, res) => {
    try {
        const { stationOwnerID, ...updateData } = req.body;
        console.log("station id is ", req.params.id);
        console.log("Station owner is ", stationOwnerID);

        const station = await PartneredChargingStation.findOneAndUpdate(
            {
                _id: req.params.id,
                station_owner_id: stationOwnerID,
                // request_status: { $in: ['processing', 'rejected'] } // Only allow editing if not approved
            },
            updateData,
            { new: true, runValidators: true }
        );

        console.log("Station Updated ", station)

        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found, not owned by user, or already approved'
            });
        }

        await sendAutoMessageToAdmin(stationOwnerID, station, 'station_updated');

        res.status(200).json({
            success: true,
            message: 'Station updated successfully',
            data: station
        });
    } catch (error) {
        console.error('Error updating station:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

//ev owner get station details
const getStationDetails = asyncHandler(async (req, res) => {
    try {
        const { stationId } = req.params;
        const { userID } = req.body;
        // console.log('Fetching details for station:', stationId);
        // console.log('User ID is :', userID);

        const station = await PartneredChargingStation.findById(stationId)
            .populate('station_owner_id', 'name email phone') // Only select specific fields
            .populate('district')
            .populate({
                path: 'chargers.connector_types.connector',
                model: 'connector' // Must match your model name exactly
            })
            .populate({
                path: 'ratings.ev_owner_id',
                select: 'name' // Only get name of the EV owner
            })
            .lean();

        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found'
            });
        }

        // Check if user has this station in favourites
        let isFavourite = false;
        // Only check favorites if userID is provided
        if (userID) {
            const evOwner = await EvOwner.findById(userID);
            if (evOwner) {
                isFavourite = evOwner.favourite_stations.includes(stationId);
            }
        }
        // console.log('Is favourite:', isFavourite);

        // Calculate average rating
        let averageRating = 0;
        if (station.ratings && station.ratings.length > 0) {
            const totalStars = station.ratings.reduce((sum, rating) => sum + rating.stars, 0);
            averageRating = totalStars / station.ratings.length;
        }

        // Transform the data for frontend
        const response = {
            ...station,
            averageRating: parseFloat(averageRating.toFixed(1)),
            totalRatings: station.ratings ? station.ratings.length : 0,
            chargers: station.chargers.map(charger => ({
                ...charger,
                price: charger.price || 0, // Ensure price exists
                connector_types: charger.connector_types.map(connectorType => ({
                    connector_id: connectorType._id,
                    status: connectorType.status,
                    connector: connectorType.connector || null,// Handle missing connectors
                    connector_img: connectorType.connector?.image ? path.join('/uploads', connectorType.connector.image) : null
                })),
                charger_status: charger.charger_status || 'processing',
                rejection_reason: charger.rejection_reason || null
            })),
            station_status: station.station_status || 'unavailable',
            isBookmarked: isFavourite,
        };
        // console.log('Station details fetched successfully:', response);
        // console.log("Connectors:", response.chargers[0].connector_types);

        res.status(200).json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('Error fetching station details:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching station details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const toggleFavoriteStation = asyncHandler(async (req, res) => {
    try {
        const { stationId } = req.params;
        const { userId } = req.body;

        // Validate inputs
        if (!stationId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Station ID and User ID are required'
            });
        }

        // Find the EV owner
        const evOwner = await EvOwner.findById(userId);
        if (!evOwner) {
            return res.status(404).json({
                success: false,
                message: 'EV Owner not found'
            });
        }

        // Check if station exists
        const stationExists = await PartneredChargingStation.exists({ _id: stationId });
        if (!stationExists) {
            return res.status(404).json({
                success: false,
                message: 'Station not found'
            });
        }

        // Toggle favorite status
        const favoriteIndex = evOwner.favourite_stations.indexOf(stationId);
        let isFavorite;

        if (favoriteIndex === -1) {
            // Add to favorites
            evOwner.favourite_stations.push(stationId);
            isFavorite = true;
        } else {
            // Remove from favorites
            evOwner.favourite_stations.splice(favoriteIndex, 1);
            isFavorite = false;
        }

        // Save the updated EV owner
        await evOwner.save();

        res.status(200).json({
            success: true,
            isFavorite,
            message: isFavorite ? 'Station added to favorites' : 'Station removed from favorites'
        });
    } catch (error) {
        console.error('Error toggling favorite station:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while toggling favorite station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// controllers/partneredChargingStationController.js

const getFavoriteStations = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate user ID
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Station ID and User ID are required'
            });
        }

        // Find the EV owner with populated favourite stations
        const evOwner = await EvOwner.findById(userId)
            .populate({
                path: 'favourite_stations',
                populate: [
                    {
                        path: 'district',
                        select: 'name province'
                    },
                    {
                        path: 'chargers.connector_types.connector',
                        model: 'connector'
                    }
                ]
            })
            .lean();

        if (!evOwner) {
            return res.status(404).json({
                success: false,
                message: 'EV Owner not found'
            });
        }

        // Transform the data for frontend
        const favouriteStations = evOwner.favourite_stations.map(station => {
            // Calculate average rating
            let averageRating = 0;
            if (station.ratings && station.ratings.length > 0) {
                const totalStars = station.ratings.reduce((sum, rating) => sum + rating.stars, 0);
                averageRating = totalStars / station.ratings.length;
            }

            return {
                _id: station._id,
                station_name: station.station_name,
                address: station.address,
                city: station.city,
                district: station.district,
                station_status: station.station_status || 'unavailable',
                electricity_provider: station.electricity_provider,
                power_source: station.power_source,
                chargers: station.chargers?.map(charger => ({
                    charger_name: charger.charger_name,
                    power_type: charger.power_type,
                    max_power_output: charger.max_power_output,
                    price: charger.price,
                    charger_status: charger.charger_status,
                    connector_types: charger.connector_types?.map(connectorType => ({
                        status: connectorType.status,
                        connector: connectorType.connector
                    }))
                })) || [],
                ratings: station.ratings || [],
                averageRating: parseFloat(averageRating.toFixed(1)),
                totalRatings: station.ratings ? station.ratings.length : 0,
                createdAt: station.createdAt,
                updatedAt: station.updatedAt
            };
        });

        res.status(200).json({
            success: true,
            data: favouriteStations
        });

    } catch (error) {
        console.error('Error fetching favourite stations:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching favourite stations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get all stations for a specific owner
const getOwnerStations = asyncHandler(async (req, res) => {
    try {
        console.log('Fetching owner stations', req.query);
        const stationOwnerID = req.query.stationOwnerId || req.user?._id; // Assuming auth middleware sets req.user

        if (!stationOwnerID) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required(Owner Stations)'
            });
        }

        // Verify station owner exists
        const owner = await StationOwner.findById(stationOwnerID);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: 'Station owner not found'
            });
        }

        // Fetch all stations for the owner
        const stations = await PartneredChargingStation.find({
            station_owner_id: stationOwnerID
        })
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

        // Format stations to match frontend expectations
        const formattedStations = stations.map(station => {
            const isNewStation = station.chargers.every(c =>
                ['processing', 'to_be_installed', 'rejected'].includes(c.charger_status)
            );
            let displayStatus = station.station_status;
            if (isNewStation && station.station_status === 'unavailable') {
                // change 'unavailable' to 'reviewing' for new stations
                displayStatus = 'reviewing'; 
            }

            if (!isNewStation && station.station_status === 'unavailable') {
                // change 'unavailable' to 'reviewing' for new stations
                displayStatus = 'closed'; 
            }

            // Calculate average rating for the station
            const stationRatings = station.ratings || [];
            const averageRating = stationRatings.length > 0 
                ? stationRatings.reduce((sum, rating) => sum + rating.stars, 0) / stationRatings.length
                : 0;

            return {
                id: station._id.toString(),
                name: station.station_name || 'Unnamed Station',
                status: displayStatus.toLowerCase(),
                address: `${station.address || ''}, ${station.city || ''}, ${station.district?.name || ''}`.trim(),
                addressLine: station.address || 'No Address Provided',
                city: station.city || 'N/A',
                district: station.district?.name || 'N/A',
                electricityProvider: station.electricity_provider || 'N/A',
                powerSource: station.power_source || 'N/A',
                location: station.location || { lat: 0, lng: 0 },
                averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
                totalRatings: stationRatings.length,
                chargers: station.chargers.map(charger => ({
                    name: charger.charger_name || 'Unnamed Charger',
                    powerType: charger.power_type || 'Unknown',
                    maxPower: charger.max_power_output || 0,
                    price: charger.price || 0,
                    chargerStatus: charger.charger_status || 'processing',
                    connectors: charger.connector_types
                        .map(ct => ct.connector?.type_name || 'N/A')
                        .filter(Boolean)
                })),
                dateOfRequest: station.createdAt
                    ? new Date(station.createdAt).toLocaleString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    })
                    : null
            };
        });

        res.status(200).json({
            success: true,
            data: formattedStations
        });
    } catch (error) {
        console.error('Error fetching owner stations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get a single station by ID by Station Owner
const getStationById = asyncHandler(async (req, res) => {
    try {
        const { stationId} = req.params;
        const stationOwnerID = req.query.stationOwnerId;

        console.log('Request received for station:', stationId);
        console.log('Station owner ID:', stationOwnerID);

        if (!stationOwnerID) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required(Get Station by ID)'
            });
        }

        // Fetch the station
        const station = await PartneredChargingStation.findOne({
            _id: stationId,
            station_owner_id: stationOwnerID
        })
        .populate('district', 'name')
        .populate({
            path: 'chargers.connector_types.connector',
            select: 'type_name',
            model: 'connector'
        })
        .lean();

        console.log('Found station:', station);

        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found'
            });
        }

        // Format station to match frontend expectations
        const isNewStation = station.chargers.every(c =>
            ['processing', 'to_be_installed', 'rejected'].includes(c.charger_status)
        );
        let displayStatus = station.station_status;
        if (isNewStation && station.station_status === 'unavailable') {
            displayStatus = 'reviewing'; 
        }

        if (!isNewStation && station.station_status === 'unavailable') {
            displayStatus = 'closed'; 
        }

        // Calculate average rating for the station
        const stationRatings = station.ratings || [];
        const averageRating = stationRatings.length > 0 
            ? stationRatings.reduce((sum, rating) => sum + rating.stars, 0) / stationRatings.length
            : 0;

        const formattedStation = {
            _id: station._id.toString(),
            station_name: station.station_name || 'Unnamed Station',
            status: displayStatus.toLowerCase(),
            address: station.address || '',
            city: station.city || '',
            district: station.district?.name || '',
            electricity_provider: station.electricity_provider || 'N/A',
            power_source: station.power_source || 'N/A',
            location: station.location || { lat: 0, lng: 0 },
            averageRating: Math.round(averageRating * 10) / 10,
            totalRatings: stationRatings.length,
            chargers: station.chargers.map(charger => ({
                charger_name: charger.charger_name || 'Unnamed Charger',
                power_type: charger.power_type || 'Unknown',
                max_power_output: charger.max_power_output || 0,
                price: charger.price || 0,
                charger_status: charger.charger_status || 'processing',
                connector_types: charger.connector_types.map(ct => ({
                    connector: {
                        _id: ct.connector?._id?.toString(),
                        type_name: ct.connector?.type_name || 'N/A'
                    },
                    status: ct.status || 'unavailable'
                })),
                createdAt: charger.createdAt,
                updatedAt: charger.updatedAt
            })),
            createdAt: station.createdAt
        };

        res.status(200).json({
            success: true,
            data: formattedStation
        });
    } catch (error) {
        console.error('Error fetching station:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching station',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get all chargers for a specific station by Station Owner
const getStationChargers = asyncHandler(async (req, res) => {
    try {
        const { stationId } = req.params;
        const stationOwnerID = req.query.stationOwnerId || req.user?._id;

        if (!stationOwnerID) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required(Get Station Chargers)'
            });
        }

        // Verify station exists and belongs to the owner
        const station = await PartneredChargingStation.findOne({
            _id: stationId,
            station_owner_id: stationOwnerID
        })
        .populate({
            path: 'chargers.connector_types.connector',
            select: 'type_name',
            model: 'connector'
        })
        .lean();

        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found'
            });
        }

        // Format chargers data - chargers are embedded in the station document
        const formattedChargers = station.chargers.map(charger => ({
            _id: charger._id.toString(),
            charger_name: charger.charger_name || 'Unnamed Charger',
            power_type: charger.power_type || 'Unknown',
            max_power_output: charger.max_power_output || 0,
            price: charger.price || 0,
            charger_status: charger.charger_status || 'processing',
            connector_types: charger.connector_types.map(ct => ({
                connector: {
                    _id: ct.connector?._id?.toString(),
                    type_name: ct.connector?.type_name || 'N/A'
                },
                status: ct.status || 'unavailable'
            })),
            createdAt: charger.createdAt,
            updatedAt: charger.updatedAt
        }));

        res.status(200).json({
            success: true,
            data: formattedChargers
        });
    } catch (error) {
        console.error('Error fetching station chargers:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching station chargers',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const updateCharger = asyncHandler(async (req, res) => {
  try {
    const { stationId, chargerId } = req.params;
    const stationOwnerID = req.query.stationOwnerId;
    const updateData = req.body;

    if (!stationOwnerID) {
      return res.status(400).json({
        success: false,
        message: 'Station owner ID is required'
      });
    }

    // Find station
    const station = await PartneredChargingStation.findOne({
      _id: stationId,
      station_owner_id: stationOwnerID
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found'
      });
    }

    // Find charger inside station
    const charger = station.chargers.id(chargerId);
    if (!charger) {
      return res.status(404).json({
        success: false,
        message: 'Charger not found'
      });
    }

    // Update fields
    charger.charger_name = updateData.charger_name || charger.charger_name;
    charger.power_type = updateData.power_type || charger.power_type;
    charger.max_power_output = updateData.max_power_output || charger.max_power_output;
    charger.price = updateData.price || charger.price;
    charger.charger_status = updateData.charger_status || charger.charger_status;

    if (Array.isArray(updateData.connector_types)) {
      charger.connector_types = updateData.connector_types.map((ct, index) => ({
        connector: ct.connector, // must be ObjectId
        status: ct.status ?? charger.connector_types[index]?.status
      }));
    }

    await station.save();

    // Re-fetch with population
    const updatedStation = await PartneredChargingStation.findById(stationId)
  .populate('chargers.connector_types.connector', 'type_name');


    const updatedCharger = updatedStation.chargers.id(chargerId);
    if (!updatedCharger) {
      return res.status(404).json({
        success: false,
        message: 'Updated charger not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: updatedCharger._id.toString(),
        charger_name: updatedCharger.charger_name,
        power_type: updatedCharger.power_type,
        max_power_output: updatedCharger.max_power_output,
        price: updatedCharger.price,
        charger_status: updatedCharger.charger_status,
        connector_types: Array.isArray(updatedCharger.connector_types)? updatedCharger.connector_types.map(ct => ({
            connector: {
                _id: ct.connector?._id?.toString(),
                type_name: ct.connector?.type_name || 'N/A'
            },
            status: ct.status || 'unavailable'
        })) : [],
        createdAt: updatedCharger.createdAt,
        updatedAt: updatedCharger.updatedAt
      },
    });
  } catch (error) {
    console.error('Error updating charger:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating charger',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});




module.exports = {
    checkStationsExist,
    createStation,
    getRequestedStations,
    deleteStation,
    updateStation,
    getStationForEdit,
    getStationDetails,
    toggleFavoriteStation,
    getFavoriteStations,
    getOwnerStations,
    getStationById,
    getStationChargers,
    updateCharger
}