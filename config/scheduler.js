const cron = require('node-cron');
const TemporaryClosure = require('../models/temporaryClosureModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel');

// Define the function that runs the schedule checks
const startScheduler = () => {
    // Cron schedule runs every minute: '* * * * *'
    cron.schedule('* * * * *', async () => {
        console.log('Running scheduled closure check...');
        const now = new Date();

        // 1. Activate PENDING closures (Close the station)
        const pendingToActivate = await TemporaryClosure.find({ 
            status: 'pending', 
            from_date_time: { $lte: now } // Start time is now or in the past
        });

        for (const closure of pendingToActivate) {
            // Update station status to unavailable
            await PartneredChargingStation.findByIdAndUpdate(
                closure.station_id, 
                { station_status: 'unavailable' }
            );
            
            // Update closure status
            closure.status = 'active';
            await closure.save();
            console.log(`Station ${closure.station_id} CLOSED by schedule.`);
        }

        // 2. Complete ACTIVE closures (Reopen the station)
        const activeToComplete = await TemporaryClosure.find({ 
            status: 'active', 
            to_date_time: { $lte: now } // End time is now or in the past
        });

        for (const closure of activeToComplete) {
            // Check if there are ANY other overlapping, currently ACTIVE closures 
            const hasOtherActiveClosures = await TemporaryClosure.countDocuments({
                station_id: closure.station_id,
                status: 'active',
                _id: { $ne: closure._id } // Exclude the current closure being completed
            });

            // If this is the last or only active closure, reopen the station
            if (hasOtherActiveClosures === 0) {
                await PartneredChargingStation.findByIdAndUpdate(
                    closure.station_id, 
                    { station_status: 'open' }
                );
                console.log(`Station ${closure.station_id} REOPENED by schedule.`);
            }
            
            // Update closure status
            closure.status = 'completed';
            await closure.save();
        }
    });

    console.log('✅ Cron scheduler initialized.');
};

module.exports = startScheduler;