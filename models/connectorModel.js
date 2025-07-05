const mongoose = require('mongoose');

const connectorSchema = new mongoose.Schema({
    type_name: {
        type: String,
        required: true
    }
},
    {timestamps: true});

const Connector = mongoose.model('connector', connectorSchema);
module.exports = Connector;