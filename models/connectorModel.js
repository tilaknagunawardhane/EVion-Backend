const { urlencoded } = require('express');
const mongoose = require('mongoose');

const connectorSchema = new mongoose.Schema({
    type_name: {
        type: String,
        required: true
    },
    current_type: {
        type: String,
        required: true
    },
    image: {
        type: URL,
        required: false
    }
},
    {timestamps: true});

const Connector = mongoose.model('connector', connectorSchema);
module.exports = Connector;