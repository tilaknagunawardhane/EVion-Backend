const mongoose = require('mongoose');

const evOwnerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    contact_number: {
        type: String,
        required: false,
    },
    home_address: {
        type: String,
        required: false
    },
},
    {timestamps: true});

const EvOwner = mongoose.model('EvOwner', evOwnerSchema);
module.exports = EvOwner;