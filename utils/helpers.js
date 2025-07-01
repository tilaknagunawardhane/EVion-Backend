const mongoose = require('mongoose');
const Vehicle = require('../models/vehicleModel');
const VehicleModel = require('../models/vehiclemodelModel');
const VehicleMake = require('../models/vehiclemakeModel');

const getVehicleById = async (vehicle_id) => {
    if (!vehicle_id) {
        throw new Error('Vehicle ID is required');
    }

    if(!mongoose.Types.ObjectId.isValid(vehicle_id)){
        throw new Error('Invalid vehicle ID');
    }

    const vehicle = await Vehicle.findById(vehicle_id)
    if(!vehicle){
        throw new Error('No such vehicle');
    }
    return vehicle;
};

const getModelName = async (model_id) => {
    if(!model_id){
        throw new Error('Model ID is required');
    }

    if(!mongoose.Types.ObjectId.isValid(model_id)){
        throw new Error('Invalid model ID');
    }

    const model = await VehicleModel.findById(model_id);
    if(!model){
        throw new Error('No such Model');
    }
    return model;
};

const getMakeName = async (make_id)  => {
    if(!make_id){
        throw new Error('Make ID is required');
    }

    if(!mongoose.Types.ObjectId.isValid(make_id)){
        throw new Error('Invalid make ID');
    }

    const make = await VehicleMake.findById(make_id);
    if(!make){
        throw new Error('No such Make');
    }
    return make;
};

module.exports = {
    getVehicleById,
    getModelName,
    getMakeName,
};