const mongoose = require('mongoose');
const populateRefFields = require('../utils/populateRefFields');

const chargerSchema = new mongoose.Schema({
    charger_name: {
        type: String,
        required: true
    },
    power_type: {
        type: String,
        required: true,
        enum: ['AC', 'DC']
    },
    max_power_output: {
        type: Number,
        required: true
    },
    connector_types: {
        type: [mongoose.Schema.Types.ObjectId], //object id array
        required: true,
        ref: 'connector'
    },
    charger_status: {
        type: String,
        enum: ['processing', 'to_be_installed', 'rejected', 'open', 'unavailable', 'disabled_by_SO', 'deleted'],
        default: 'processing',
        required: true
    },
    rejection_reason: {
        type: String,
        default: null
    },
}, {
    _id: true,
    timestamps: true
})

const partneredChargingStationSchema = new mongoose.Schema({
    station_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'stationowner',
        required: true
    },
    station_name: {
        type: String,
        required: true
    },
    district: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'district',
        required: true
    },
    address: {
        type: String,
        required: false
    },
    city: {
        type: String,
        required: true
    },
    electricity_provider: {
        type: String,
        enum: ['CEB', 'LECO', 'Private'],
        required: false
    },
    power_source: {
        type: String,
        enum: ['Grid', 'Solar', 'Hybrid'],
        required: false
    },
    station_status: {
        type: String,
        enum: ['open', 'unavailable', 'disabled_by_SO', 'deleted'],
        default: 'unavailable',
        required: true
    },
    chargers: [chargerSchema]
},
    { timestamps: true });


//pre save hook
// partneredChargingStationSchema.pre('save', async function (next) {
//     if (this.isModified('station_owner_id') || this.isNew) {
//         try {
//             const station_owner_doc = await mongoose.model('stationowner').findById(this.station_owner_id);
//             if (station_owner_doc) {
//                 this.station_owner_info = {
//                     name: station_owner_doc.name
//                 };
//             }
//         } catch (err) {
//             return next(err);
//         }
//     }
//     next();
// });

const PartneredChargingStation = mongoose.model('partneredChargingStation', partneredChargingStationSchema);
module.exports = PartneredChargingStation;