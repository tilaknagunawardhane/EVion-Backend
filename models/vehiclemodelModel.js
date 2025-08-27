const mongoose = require('mongoose');
const populateRefFields = require('../utils/populateRefFields');

const vehiclemodelSchema = new mongoose.Schema({
    model: {
        type: String,
        required: true
    },
    make: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'vehiclemake',
        required: true
    },
    make_info: {
        make: String
    }
},
    {timestamps: true});

populateRefFields({
    refField: 'make',
    embedField: 'make_info',
    modelName: 'vehiclemake',
    fields: ['make']
}).applyTo(vehiclemodelSchema);             

const VehicleModel = mongoose.model('vehiclemodel', vehiclemodelSchema);
module.exports = VehicleModel;