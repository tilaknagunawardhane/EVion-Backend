const VehicleModel = require('../models/vehiclemodelModel');
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

module.exports = {
    getModelName
};