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
        match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    contact_number: {
        type: String,
        required: true,
    },
    home_address: {
        type: String,
        required: true
    },
},
    {timestamps: true});

const EvOwner = mongoose.model('EvOwner', evOwnerSchema);
module.exports = EvOwner;