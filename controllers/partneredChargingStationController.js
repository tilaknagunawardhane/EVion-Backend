const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');
const path = require('path');
const EvOwner = require('../models/evOwnerModel');

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

        res.status(201).json({
            success: true,
            message: 'Station request submitted successfully',
            data: newStation,
            shouldNavigateToDashboard: hasFinishedStation // Add this flag
        });

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
                status: safeStation.request_status,
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

        const station = await PartneredChargingStation.findOneAndUpdate(
            {
                _id: req.params.id,
                station_owner_id: stationOwnerID,
                request_status: { $in: ['processing', 'rejected'] } // Only allow editing if not approved
            },
            updateData,
            { new: true, runValidators: true }
        );

        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Station not found, not owned by user, or already approved'
            });
        }

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
        const {userID} = req.body;
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
                    connector: connectorType.connector || null ,// Handle missing connectors
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
        message: 'Station owner ID is required'
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
            displayStatus = 'processing';
        }

        return {
            id: station._id.toString(),
            name: station.station_name || 'Unnamed Station',
            status: displayStatus.toLowerCase(),
            address: `${station.address || ''}, ${station.city || ''}`.trim(),
            addressLine: station.address || 'No Address Provided',
            city: station.city || 'N/A',
            district: station.district?.name || 'N/A',
            electricityProvider: station.electricity_provider || 'N/A',
            powerSource: station.power_source || 'N/A',
            location: station.location || { lat: 0, lng: 0 },
            chargers: station.chargers.map(charger => ({
                name: charger.charger_name || 'Unnamed Charger',
                powerType: charger.power_type || 'Unknown',
                maxPower: charger.max_power_output || 0,
                price: charger.price || 0,
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
}