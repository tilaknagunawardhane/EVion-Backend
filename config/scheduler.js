const cron = require('node-cron');
const TemporaryClosure = require('../models/temporaryClosureModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel');

// Helper function to get the station's operating status based on its schedule for the current time
const getScheduleStatus = (station, now) => {
    if (!station.station_schedule) {
        //console.warn(`Station ${station._id} is missing schedule data. Defaulting to unavailable.`);
        return 'unavailable';
    }

    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const daySchedule = station.station_schedule[dayOfWeek];
    
    // Check if any charger is operational (open or unavailable)
    const hasOperationalCharger = station.chargers.some(charger =>
        charger.charger_status === 'open' || charger.charger_status === 'unavailable'
    );
    
    // If no operational chargers exist, the station must remain unavailable
    if (!hasOperationalCharger) {
        return 'unavailable';
    }

    if (!daySchedule || daySchedule.closed) {
        return 'unavailable'; // Closed or no schedule set for the day
    }

    if (daySchedule.open24Hours) {
        return 'open'; // Open 24/7
    }

    // Check specific time blocks
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (daySchedule.timeBlocks && daySchedule.timeBlocks.length > 0) {
        for (const block of daySchedule.timeBlocks) {

            if (!block.from || !block.to) continue;

            const [startH, startM] = block.from.split(':').map(Number);
            const [endH, endM] = block.to.split(':').map(Number);

            const scheduledStartMinutes = startH * 60 + startM;
            const scheduledEndMinutes = endH * 60 + endM;

            if (currentMinutes >= scheduledStartMinutes && currentMinutes < scheduledEndMinutes) {
                return 'open'; // Currently within a scheduled time block
            }
        }
    }

    return 'unavailable'; // Outside of scheduled time blocks
};


const startScheduler = () => {
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const stationIdsToProcess = new Set();
        
        // Find all unique station IDs involved in active/pending closures
        const activeOrPendingClosures = await TemporaryClosure.find({ 
            status: { $in: ['pending', 'active'] } 
        }, 'station_id');
        
        activeOrPendingClosures.forEach(closure => stationIdsToProcess.add(closure.station_id.toString()));

        // --- 1. Process Closure Activations (Pending -> Active) ---
        const pendingToActivate = await TemporaryClosure.find({ 
            status: 'pending', 
            from_date_time: { $lte: now }
        });

        for (const closure of pendingToActivate) {
            stationIdsToProcess.add(closure.station_id.toString());
            // Update closure status
            await TemporaryClosure.updateOne(
                { _id: closure._id }, 
                { $set: { status: 'active' } }
            );
            console.log(`Closure ${closure._id} ACTIVATED.`);
        }

        // --- 2. Process Closure Completion (Active -> Completed) ---
        const activeToComplete = await TemporaryClosure.find({ 
            status: 'active', 
            to_date_time: { $lte: now } 
        });

        for (const closure of activeToComplete) {
            stationIdsToProcess.add(closure.station_id.toString());
            // Update closure status
            await TemporaryClosure.updateOne(
                { _id: closure._id }, 
                { $set: { status: 'completed' } }
            );
            console.log(`Closure ${closure._id} COMPLETED.`);
        }
        
        // --- 3. Determine and Apply Final Station Status ---
        
        const stationsToUpdate = await PartneredChargingStation.find({ 
            _id: { $in: Array.from(stationIdsToProcess) } 
        }).lean(); 
        
        // Also fetch any stations that might need status updates due to regular schedule changes
        // This is complex, so we'll simplify and check all stations to keep the cron job simple.

        // Fetch stations whose status is NOT permanently restricted
        const stationsToCheck = await PartneredChargingStation.find({
            station_status: { $nin: ['disabled_by_SO', 'deleted'] }
        })
        .populate('chargers')
        .lean();

        for (const station of stationsToCheck) {
            
            // A. Check for Overriding Temporary Closures
            const isTemporarilyClosed = await TemporaryClosure.exists({
                station_id: station._id,
                status: 'active'
            });

            if (isTemporarilyClosed) {
                // If there's an active temporary closure, the status must be UNAVAILABLE.
                if (station.station_status !== 'unavailable') {
                    await PartneredChargingStation.findByIdAndUpdate(station._id, { station_status: 'unavailable' });
                    console.log(`Station ${station._id} set to UNAVAILABLE (Active Closure).`);
                }
            } else {
                // B. If no active temporary closure, apply the regular schedule status.
                const scheduledStatus = getScheduleStatus(station, now);
                
                if (station.station_status !== scheduledStatus) {
                    await PartneredChargingStation.findByIdAndUpdate(station._id, { station_status: scheduledStatus });
                    console.log(`Station ${station._id} set to ${scheduledStatus.toUpperCase()} (Regular Schedule).`);
                }
            }
        }
        
        console.log('Finished scheduled closure check.');
    });

    console.log('✅ Cron scheduler initialized.');
};

module.exports = startScheduler;

// const cron = require('node-cron');
// const TemporaryClosure = require('../models/temporaryClosureModel');
// const PartneredChargingStation = require('../models/partneredChargingStationModel');

// // Define the function that runs the schedule checks
// const startScheduler = () => {
//     // Cron schedule runs every minute: '* * * * *'
//     cron.schedule('* * * * *', async () => {
//         console.log('Running scheduled closure check...');
//         const now = new Date();

//         // 1. Activate PENDING closures (Close the station)
//         const pendingToActivate = await TemporaryClosure.find({ 
//             status: 'pending', 
//             from_date_time: { $lte: now } // Start time is now or in the past
//         });

//         for (const closure of pendingToActivate) {
//             // Update station status to unavailable
//             await PartneredChargingStation.findByIdAndUpdate(
//                 closure.station_id, 
//                 { station_status: 'unavailable' }
//             );
            
//             // Update closure status
//             closure.status = 'active';
//             await closure.save();
//             console.log(`Station ${closure.station_id} CLOSED by schedule.`);
//         }

//         // 2. Complete ACTIVE closures (Reopen the station)
//         const activeToComplete = await TemporaryClosure.find({ 
//             status: 'active', 
//             to_date_time: { $lte: now } // End time is now or in the past
//         });

//         for (const closure of activeToComplete) {
//             // Check if there are ANY other overlapping, currently ACTIVE closures 
//             const hasOtherActiveClosures = await TemporaryClosure.countDocuments({
//                 station_id: closure.station_id,
//                 status: 'active',
//                 _id: { $ne: closure._id } // Exclude the current closure being completed
//             });

//             // If this is the last or only active closure, reopen the station
//             if (hasOtherActiveClosures === 0) {
//                 await PartneredChargingStation.findByIdAndUpdate(
//                     closure.station_id, 
//                     { station_status: 'open' }
//                 );
//                 console.log(`Station ${closure.station_id} REOPENED by schedule.`);
//             }
            
//             // Update closure status
//             closure.status = 'completed';
//             await closure.save();
//         }
//     });

//     console.log('✅ Cron scheduler initialized.');
// };

// module.exports = startScheduler;

