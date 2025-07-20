const mongoose = require('mongoose');

const partneredChargingStationSchema = new mongoose.Schema({
    station_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'stationowner',
        required: true
    },
    station_owner_info: {
        name: String
    },
    station_name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    request_status: {
        type: String,
        enum: ['processing', 'approved', 'to-be-installed'],
        default: 'processing',
        required: true
    },
    station_status: {
        type: String,
        enum: ['active', 'in-progress', 'under-maintenance', 'closed', 'disabled'],
        default: 'in-progress',
        required: true
    }
},
    { timestamps: true });

//pre save hook
partneredChargingStationSchema.pre('save', async function (next) {
    if (this.isModified('station_owner_id') || this.isNew) {
        try {
            const station_owner_doc = await mongoose.model('stationowner').findById(this.station_owner_id);
            if (station_owner_doc) {
                this.station_owner_info = {
                    name: station_owner_doc.name
                };
            }
        } catch (err) {
            return next(err);
        }
    }
    next();
});

const PartneredChargingStation = mongoose.model('partneredChargingStation', partneredChargingStationSchema);
module.exports = PartneredChargingStation;