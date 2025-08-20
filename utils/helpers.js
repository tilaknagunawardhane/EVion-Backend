const mongoose = require('mongoose');
const Vehicle = require('../models/vehicleModel');
const VehicleModel = require('../models/vehiclemodelModel');
const VehicleMake = require('../models/vehiclemakeModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const Connector = require('../models/connectorModel');
const EvOwner = require('../models/evOwnerModel');

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

const getVehiclesByOwner = async (owner_id) => {
    if(!owner_id){
        throw new Error('Owner ID is required');
    }
    if(!mongoose.Types.ObjectId.isValid(owner_id)){
        throw new Error('Invalid owner ID');
    }
    const ownedVehicles = await EvOwner.findById(owner_id).select('vehicles')
        .populate('vehicles.make', 'make')        // populate vehiclemake
        .populate('vehicles.model', 'model')            // populate vehiclemodel
        .populate('vehicles.color', 'name hex')        // populate vehiclecolor
        .populate('vehicles.connector_type_AC', 'type_name current_type image')
        .populate('vehicles.connector_type_DC', 'type_name current_type image')
        .lean();

    if(!ownedVehicles){
        throw new Error('No owner');
    }
    if(!ownedVehicles || ownedVehicles.length === 0){
        throw new Error('No owned vehicles');
    }

    return ownedVehicles;
}

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

const getPartneredChargingStation = async (charging_station_id) => {
    if(!charging_station_id){
        throw new Error('Charging station ID is required');
    }

    if(!mongoose.Types.ObjectId.isValid(charging_station_id)){
        throw new Error('Invalid charging station ID');
    }

    const partnered_charging_station = await PartneredChargingStation.findById(charging_station_id);
    if(!partnered_charging_station){
        throw new Error('No such charging staion');
    }
    return partnered_charging_station;
};

const getConnectorById = async (connector_id) => {
    if(!connector_id){
        throw new Error('Connector ID is required');
    }

    if(!mongoose.Types.ObjectId.isValid(connector_id)){
        throw new Error('Invalid connector ID');
    }

    const connector = await Connector.findById(connector_id);
    if(!connector){
        throw new Error('No such connection');
    }
    return connector;
};

module.exports = {
    getVehicleById,
    getModelName,
    getMakeName,
    getPartneredChargingStation,
    getConnectorById,
    getVehiclesByOwner,
};