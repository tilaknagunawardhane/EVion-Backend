const mongoose = require('mongoose');

const colorSchema = new mongoose.Schema({
    
    color: {
        type: String,
        required: true
    },
},
    {timestamps: true});

const Color = mongoose.model('vehiclecolor', colorSchema);
module.exports = Color;