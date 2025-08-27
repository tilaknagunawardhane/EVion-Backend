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
        type: String,
        required: false
    }
},
<<<<<<< HEAD
    {
        _id: true,
        timestamps: true
    });
=======
    {timestamps: true});
>>>>>>> 6cb7d28b7b986dcdd2eb39709afb722fa6622b00

const Connector = mongoose.model('connector', connectorSchema);
module.exports = Connector;