const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationOwner = require('../models/stationOwnerModel');

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
        }).select('request_status station_status');

        // 3. Check conditions
        const hasApprovedStation = stations.some(
            station => station.request_status === 'finished'
        );
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
        const stations = await PartneredChargingStation.find({ station_owner_id: stationOwnerID, station_status: 'in-progress' })
            .populate('station_owner_id', 'name email')
            .populate('district', 'name')
            .populate('chargers.connector_types', 'type_name')
            .lean();

        if (!stations || stations.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No stations found'
            });
        }


        const transformedStations = stations.map(station => {
            // Safe defaults for station
            const safeStation = {
                station_name: '',
                request_status: 'processing',
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
                    ...charger
                };

                return {
                    name: safeCharger.charger_name,
                    powerType: safeCharger.power_type,
                    maxPower: safeCharger.max_power_output,
                    connectors: Array.isArray(safeCharger.connector_types)
                        ? safeCharger.connector_types.map(ct => ct?.type_name || 'Unknown').filter(Boolean)
                        : []
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
        console.log('Fetching details for station:', stationId);

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
                    status: connectorType.status,
                    connector: connectorType.connector || null // Handle missing connectors
                })),
                charger_status: charger.charger_status || 'processing',
                rejection_reason: charger.rejection_reason || null
            })),
            station_status: station.station_status || 'unavailable'
        };

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

module.exports = {
    checkStationsExist,
    createStation,
    getRequestedStations,
    deleteStation,
    updateStation,
    getStationForEdit,
    getStationDetails
}