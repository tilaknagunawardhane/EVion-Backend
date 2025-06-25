const monogoose = require('mongoose');

const vehiclemakeSchema = new monogoose.Schema({
    make: {
        type: String,
        required: true
    }
},
    {timestamps: true});

const VehicleMake = mongoose.model('vehiclemake', vehiclemakeSchema);
module.exports = VehicleMake;