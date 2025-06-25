const VehicleModel = require('../models/vehiclemodelModel');
const VehicleMake = require('../models/vehiclemakeModel');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

const getModelName = asyncHandler(async (req, res) => {
    let { vehicle_model_id } = req.body;

    if(!mongoose.Types.ObjectId.isValid(vehicle_model_id)){
        return res.status(400).json({ message: 'Invalid Vehicle Model ID' });
    }
    vehicle_model_id = new mongoose.Types.ObjectId(vehicle_model_id);
    console.log('vehicle model id: ', vehicle_model_id);

    const model_name = await VehicleModel.findOne({
        _id: vehicle_model_id
    });

    if(!model_name){
        return res.json({ message: 'No such model' });
    }else{
        console.log('model name: ', model_name);
        return res.status(200).json(model_name.model);
    }
});

const getMakeName = asyncHandler(async (req, res) => {
    let { vehicle_make_id } = req.body;

    if(!mongoose.Types.ObjectId.isValid(vehicle_make_id)){
        return res.status(400).json({ message: 'Invalid Vehicle Make ID' });
    }
    vehicle_make_id = new mongoose.Types.ObjectId(vehicle_make_id);
    console.log('vehicle make id: ', vehicle_make_id);

    const make_name = await VehicleMake.findOne({
        _id: vehicle_make_id
    });

    if(!make_name){
        return res.json({ message: 'No such make' });
    }else{
        console.log('make name: ', make_name);
        return res.status(200).json(make_name.make);
    }
});

module.exports = {
    getModelName,
    getMakeName
};