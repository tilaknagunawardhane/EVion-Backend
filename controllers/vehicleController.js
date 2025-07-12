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
            image: req.file ? `/uploads/vehicles/${req.file.filename}` : null
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
})


module.exports = {
    getDropdownData,
    getConnectorTypes,
    addVehicle,
    uploadVehicleImage
};