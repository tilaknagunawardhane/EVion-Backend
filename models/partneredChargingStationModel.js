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
    }

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
    // station_owner_info: {
    //     type: Object,
    //     default: null
    // },
    station_name: {
        type: String,
        required: true
    },
    district: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'district',
        required: true
    },
    // district_info: {
    //     type: Object,
    //     default: null
    // },
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
    request_status: {
        type: String,
        enum: ['processing', 'approved', 'to-be-installed', 'finished'],
        default: 'processing',
        required: true
    },
    station_status: {
        type: String,
        enum: ['active', 'in-progress', 'under-maintenance', 'closed', 'disabled'],
        default: 'in-progress',
        required: true
    },
    chargers: [chargerSchema]
},
    { timestamps: true });

// populateRefFields({
//     refField: 'station_owner_id',
//     embedField: 'station_owner_info',
//     modelName: 'StationOwner',
//     fields: ['name', 'email', 'contact']
// })


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