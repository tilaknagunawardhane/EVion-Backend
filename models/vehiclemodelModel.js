const mongoose = require('mongoose');

const vehiclemodelSchema = new mongoose.Schema({
    model: {
        type: String,
        required: true
    },
    make: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'vehiclemake',
        required: true
    },
    make_info: {
        make: String
    }
},
    {timestamps: true});

// Pre save hook
vehiclemodelSchema.pre('save', async function (next) {
    // populate if field was modified or on first save
    if (this.isModified('make') || this.isNew) {
        try {
            const makeDoc = await mongoose.model('vehiclemake').findById(this.make);
            if (makeDoc) {
                this.make_info = {
                    make: makeDoc.make
                };
            }
        } catch (err) {
            return next(err);
        }
    }
    next();
});

// Pre findOneAndUpdate hook for update queries
vehiclemodelSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();

    if (update.make) {
        try {
            const makeDoc = await mongoose.model('vehiclemake').findById(update.make);
            if (makeDoc) {
                update.make_info = {
                    make: makeDoc.make
                };
                this.setUpdate(update);
            }
        } catch (err) {
            return next(err);
        }
    }

    next();
});

const VehicleModel = mongoose.model('vehiclemodel', vehiclemodelSchema);
module.exports = VehicleModel;