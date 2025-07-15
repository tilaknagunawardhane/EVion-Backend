const VehicleMake = require('../models/vehiclemakeModel');
const VehicleModel = require('../models/vehiclemodelModel');
const VehicleColor = require('../models/vehicleColorModel');
const asyncHandler = require('express-async-handler');
const Connector = require('../models/connectorModel');
const path = require('path');
const EvOwner = require('../models/evOwnerModel');
const { imageUpload } = require('../utils/fileUpload');
const mongoose = require('mongoose');

const uploadVehicleImage = imageUpload({
    destination: 'uploads/vehicles',
    fieldName: 'vehicleImage',
    maxFileSize: 10 * 1024 * 1024 // 10MB
});

const addVehicle = asyncHandler(async (req, res) => {
    try {
        const {
            ownerId,
            vehicleMakeId,
            vehicleModelId,
            manufactureYear,
            colorId,
            vehicleType,
            batteryCapacity,
            selectedPlugIds,
            batteryHealth,
            chargingPowerAC,
            chargingPowerDC
        } = req.body;
        let connector_type_AC = null;
        let connector_type_DC = null;

        if (selectedPlugIds) {
            const parsedPlugs = JSON.parse(selectedPlugIds);
            if (parsedPlugs.length > 0) connector_type_AC = parsedPlugs[0];
            if (parsedPlugs.length > 1) connector_type_DC = parsedPlugs[1];
        }

        // Validation
        if (!ownerId) {
            return res.status(400).json({ message: 'Owner id required' });
        }
        if (!vehicleMakeId || !vehicleModelId || !manufactureYear || !batteryCapacity ||
            !chargingPowerAC || !chargingPowerDC || !connector_type_AC) {
            return res.status(400).json({ message: 'Please fill in all required fields' });
        }

        const owner = await EvOwner.findById(ownerId);
        if (!owner) {
            return res.status(404).json({ message: 'Owner not found' });
        }

        // Create vehicle data with proper ObjectIds
        const vehicleData = {
            make: vehicleMakeId,
            model: vehicleModelId,
            color: colorId ? colorId : null,
            manufactured_year: parseInt(manufactureYear),
            vehicle_type: vehicleType || null,
            battery_capacity: parseFloat(batteryCapacity),
            connector_type_AC: connector_type_AC,
            connector_type_DC: connector_type_DC,
            battery_health: batteryHealth ? parseFloat(batteryHealth) : null,
            max_power_AC: parseFloat(chargingPowerAC),
            max_power_DC: parseFloat(chargingPowerDC),
            image: req.file ? `/uploads/vehicles/${req.file.filename}` : null,
            isActive: true
        };

        // Add the vehicle and save
        owner.vehicles.push(vehicleData);
        await owner.save();

        const updatedOwner = await EvOwner.findById(ownerId);
        // console.log(updatedOwner)

        // Get the newly added vehicle ID
        const newVehicle = updatedOwner.vehicles[updatedOwner.vehicles.length - 1];
        const vehicleId = newVehicle._id;

        const response = {
            success: true,
            message: 'Vehicle added successfully',
            data: {
                userID: ownerId,
                newVehicleID: vehicleId
            }

        }
        // console.log("Response ", response);

        res.status(201).json(response);

    } catch (error) {
        console.error('Error in addVehicle:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


const getDropdownData = asyncHandler(async (req, res) => {

    try {
        const vehicleMakes = await VehicleMake.find();
        const vehicleModels = await VehicleModel.find();
        const vehicleColors = await VehicleColor.find();

        // console.log(vehicleColors, vehicleMakes, vehicleModels);
        return res.status(200).json({
            success: true,
            data: {
                vehicleMakes,
                vehicleModels,
                vehicleColors
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dropdown data',
            error: error.message
        });
    }


});

const getConnectorTypes = asyncHandler(async (req, res) => {
    try {
        const connectors = await Connector.find();
        const connectorsWithImages = connectors.map(connector => ({
            _id: connector._id,
            type_name: connector.type_name,
            current_type: connector.current_type,
            image: connector.image
                ? path.join('/uploads', connector.image) : null
        }));

        res.status(200).json({
            success: true,
            data: connectorsWithImages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch connector types',
            error: error.message
        });
    }
});

const fetchVehicles = asyncHandler(async (req, res) => {
    try {
        const { userID } = req.body;
        console.log(req.body);

        const user = await EvOwner.findById(userID);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        const formattedVehicles = user.vehicles
            .filter(vehicle => vehicle !== null && vehicle.isActive === true)
            .map(vehicle => {
                // Format vehicle data
                const vehicleData = {
                    ...vehicle.toObject(),
                    // Add full image URLs
                    image: vehicle.image ? `/uploads/vehicles/${vehicle.image}` : null,
                    connectorImages: {
                        AC: vehicle.connector_type_AC_info?.image
                            ? `/uploads/${vehicle.connector_type_AC_info.image}`
                            : null,
                        DC: vehicle.connector_type_DC_info?.image
                            ? `/uploads/${vehicle.connector_type_DC_info.image}`
                            : null
                    },

                };

                return vehicleData;
            });

        res.status(200).json({
            success: true,
            count: formattedVehicles.length,
            data: formattedVehicles
        });

    }
    catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching vehicles',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getVehicleByID = async (req, res) => {
    try {
        const { userID, vehicleID } = req.body;
        const user = await EvOwner.findById(userID);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        const vehicle = user.vehicles.find(v => v && v._id.toString() === vehicleID && v.isActive === true);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found',
            });
        }

        const formattedVehicle = {
            ...vehicle.toObject(),
            connectorImages: {
                AC: vehicle.connector_type_AC_info?.image
                    ? `/uploads/${vehicle.connector_type_AC_info.image}`
                    : null,
                DC: vehicle.connector_type_DC_info?.image
                    ? `/uploads/${vehicle.connector_type_DC_info.image}`
                    : null
            }
        };

        res.status(200).json({
            success: true,
            data: formattedVehicle
        });

    } catch (error) {
        console.error('Error fetching vehicle:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching vehicle',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

const deactivateVehicle = async (req, res) => {
    try {
        const { userID, vehicleID } = req.body;
        const result = await EvOwner.findOneAndUpdate(
            {
                _id: userID,
                "vehicles._id": vehicleID,
            },
            {
                $set: {
                    "vehicles.$.isActive": false,
                    "vehicles.$.updatedAt": new Date()
                }
            },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'User or vehicle not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Vehicle deleted successfully',
        });

    } catch (error) {
        console.error('Error deactivating vehicle:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deactivating vehicle',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

module.exports = {
    getDropdownData,
    getConnectorTypes,
    addVehicle,
    uploadVehicleImage,
    fetchVehicles,
    getVehicleByID,
    deactivateVehicle
};