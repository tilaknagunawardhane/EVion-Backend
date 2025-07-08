const VehicleMake = require('../models/vehiclemakeModel');
const VehicleModel = require('../models/vehiclemodelModel');
const VehicleColor = require('../models/vehicleColorModel');
const asyncHandler = require('express-async-handler');
const Connector = require('../models/connectorModel');
const path = require('path');

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
    getConnectorTypes
};