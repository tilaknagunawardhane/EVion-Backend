const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const ChargingSession = require('../models/chargingSessionModel');
const ChargerReport = require('../models/chargerReportModel');
const BookingReport = require('../models/bookingReportModel');
const Booking = require('../models/bookingModel');
const EvOwner = require('../models/evOwnerModel');
const Connector = require('../models/connectorModel');

const mongoose = require('mongoose');

// Get Charger Details for a Station Owner's Station
const getChargerDetailsForStation = asyncHandler(async (req, res) => {

    const { stationId } = req.params;
    const stationOwnerID = req.query.stationOwnerId || req.user?._id; 

    if (!stationOwnerID) {
        return res.status(401).json({ success: false, message: 'Authorization required.' });
    }

    try {
        // 1. Fetch the station and its chargers
        const station = await PartneredChargingStation.findOne({
            _id: stationId,
            station_owner_id: stationOwnerID
        })
        .select('chargers') // Select only the chargers subdocument array
        .populate('chargers.connector_types.connector', 'type_name') // Populate connector names
        .lean();

        if (!station) {
            return res.status(404).json({ success: false, message: 'Station not found.' });
        }
        
        const chargerIds = station.chargers.map(c => c._id);

        // 2. Aggregate Total Sessions and Revenue for all chargers concurrently
        const sessionStats = await ChargingSession.aggregate([
            { $match: { 
                station_id: stationId,
                charger_id: { $in: chargerIds },
                status: { $in: ['active', 'completed'] } 
            }},
            { $group: {
                _id: '$charger_id',
                totalSessions: { $sum: 1 },
                totalRevenue: { $sum: '$total_cost' } // Assuming total_cost is the owner's revenue part
            }}
        ]);
        
        const sessionStatsMap = new Map(sessionStats.map(item => [item._id.toString(), item]));

        // 3. Count Active Reports for all chargers concurrently
        const activeReports = await ChargerReport.aggregate([
            { $match: { 
                station_id: stationId,
                charger_id: { $in: chargerIds },
                status: 'under-review' // Assuming 'under-review' counts as active
            }},
            { $group: {
                _id: '$charger_id',
                activeReports: { $sum: 1 }
            }}
        ]);
        
        const reportStatsMap = new Map(activeReports.map(item => [item._id.toString(), item]));

        // 4. Combine data and format for the frontend table
        const formattedChargers = station.chargers.map(charger => {
            const stats = sessionStatsMap.get(charger._id.toString()) || {};
            const reports = reportStatsMap.get(charger._id.toString()) || {};
            const connectorsList = charger.connector_types.map(ct => ct.connector?.type_name).join(', ');
            
            return {
                chargerID: charger._id.toString(), // Use MongoDB ID for navigation/key
                'Charger Name': charger.charger_name,
                'Joined On': charger.createdAt ? new Date(charger.createdAt).toLocaleDateString() : 'N/A',
                'Power Type': charger.power_type,
                'Maximum Power Output(kW)': `${charger.max_power_output} kW`,
                'Connectors': connectorsList,
                'Unit Price(per kW)': charger.price.toFixed(2),
                'Total Sessions': stats.totalSessions || 0,
                'Revenue': (stats.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                'No of Active Reports': reports.activeReports || 0,
                'Charger Status': charger.charger_status.replace(/_/g, ' ')
            };
        });

        res.status(200).json({
            success: true,
            data: formattedChargers
        });

    } catch (error) {
        console.error('Error fetching charger details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching charger details.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get Single Charger Profile Data
const getSingleChargerProfileData = asyncHandler(async (req, res) => {

    const { stationId, chargerId } = req.params;
    const stationOwnerID = req.query.stationOwnerId || req.user?._id; 
    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(now.getDate() + 3);

    if (!stationOwnerID) {
        return res.status(401).json({ success: false, message: 'Authorization required.' });
    }

    try {
        // 1. Fetch Station/Charger Base Data
        const station = await PartneredChargingStation.findOne({
            _id: stationId,
            station_owner_id: stationOwnerID,
            "chargers._id": chargerId // Efficiently check if charger belongs to the station/owner
        })
        .select('chargers station_name')
        .populate('chargers.connector_types.connector', 'type_name')
        .lean();

        if (!station) {
            return res.status(404).json({ success: false, message: 'Charger or Station not found.' });
        }

        // Extract the specific charger subdocument
        const charger = station.chargers.find(c => c._id.toString() === chargerId);
        if (!charger) {
             return res.status(404).json({ success: false, message: 'Charger not found within station.' });
        }
        
        // 2. Fetch Current/Active Session
        const currentSession = await ChargingSession.findOne({
            charger_id: chargerId,
            status: 'active'
        }).lean(); // Select relevant fields for session card

        // 3. Fetch Upcoming Bookings (Next 3 days)
        const upcomingBookings = await Booking.find({
            charger_id: chargerId,
            status: 'upcoming',
            start_time: { $lt: threeDaysLater } // Only fetch bookings within the next 3 days
        }).select('start_time end_time booking_date connector_type_id').lean();

        // 4. Format Data for Frontend
        const formattedCharger = {
            id: charger._id.toString(),
            'Charger Name': charger.charger_name,
            'Power Type': charger.power_type,
            'Maximum Power Output(kW)': `${charger.max_power_output} kW`,
            'Unit Price(per kW)': charger.price.toFixed(2),
            connectors: charger.connector_types.map(ct => ({
                id: ct._id.toString(),
                name: ct.connector?.type_name,
                status: ct.status
            }))
        };

        const formattedSession = currentSession ? {
            // Need to link vehicle/user info if required by frontend
            vehicle: 'EV User A (Tesla M3)', // Placeholder - requires populating ev_owner_id/vehicle_id
            startTime: new Date(currentSession.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            startDate: currentSession.start_time.toISOString().slice(0, 10), // Date part for duration calculation
            energy: (currentSession.energy_delivered || 0).toFixed(2),
            cost: (currentSession.total_cost || 0).toFixed(2),
            status: currentSession.status
        } : null;

        const formattedBookings = upcomingBookings.map(b => {
            const date = new Date(b.start_time);
            // Calculate dateOffset (0=Today, 1=Tomorrow, 2=Day after)
            const dateOffset = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            return {
                dateOffset: dateOffset < 0 ? 0 : dateOffset, // Ensure minimum 0
                startTime: new Date(b.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                endTime: new Date(b.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                connectorId: b.connector_type_id.toString(), // To map booking to connector slot
                bookingId: b._id.toString(),
            };
        });

        res.status(200).json({
            success: true,
            data: {
                chargerDetails: formattedCharger,
                currentSession: formattedSession,
                bookings: formattedBookings
            }
        });

    } catch (error) {
        console.error('Error fetching charger profile data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching charger profile data.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get Charging Sessions for a Specific Charger
const getSessionsByCharger = asyncHandler(async (req, res) => {

    const { chargerId } = req.params;
    const stationOwnerID = req.query.stationOwnerId || req.user?._id; 

    if (!stationOwnerID) {
        return res.status(401).json({ success: false, message: 'Authorization required.' });
    }

    try {
        // Optional Security Check: Ensure the charger belongs to the owner's station
        const station = await PartneredChargingStation.findOne({
             "chargers._id": chargerId,
             station_owner_id: stationOwnerID
        }).select('_id').lean();

        if (!station) {
            return res.status(404).json({ success: false, message: 'Charger not found or access denied.' });
        }
        
        // 1. Fetch all completed/active sessions for this charger, sorted by start time
        const sessions = await ChargingSession.find({
            charger_id: chargerId,
            status: { $in: ['active', 'completed', 'interrupted', 'failed'] }
        })
        .sort({ start_time: -1 }) // Newest first
        .populate({
            path: 'connector_id',
            select: 'type_name', // Only fetch the name field
            model: 'connector' // The model name ref in the ChargingSession schema
        })
        // If you need EV user or vehicle details, you must populate ev_owner_id or vehicle_id here.
        .lean();

        // const sessions = await ChargingSession.aggregate([
        //     {
        //         $match: {
        //             charger_id: new mongoose.Types.ObjectId(chargerId),
        //             status: { $in: ['active', 'completed', 'interrupted', 'failed'] }
        //         }
        //     },
            
        //     // 🟢 LOOKUP: Get Connector Details
        //     {
        //         $lookup: {
        //             from: 'connector', // CRITICAL: This MUST match the actual MongoDB collection name for Connector model
        //             localField: 'connector_id',
        //             foreignField: '_id',
        //             as: 'connectorInfo'
        //         }
        //     },
        //     // Unwind to de-array the connectorInfo lookup results (will be empty for null/missing)
        //     { $unwind: { path: '$connectorInfo', preserveNullAndEmptyArrays: true } },
            
        //     // Final Projection
        //     {
        //         $project: {
        //             SessionID: '$_id',
        //             start_time: 1,
        //             end_time: 1,
        //             energy_delivered: 1,
        //             total_cost: 1,
        //             payment_status: 1,
        //             booking_id: 1,
                    
        //             // 🟢 PROJECT CONNECTOR NAME
        //             connectorName: '$connectorInfo.type_name', 
                    
        //             // Add other simple fields needed for formatting loop
        //             vehicleDisplay: 'Walk-in/Unregistered EV' // Use simple placeholder for Vehicle
        //         }
        //     },
        //     { $sort: { start_time: -1 } } 
        // ]);

        // 2. Format data to match frontend table columns (sessionsColumns)
        const formattedSessions = sessions.map(session => {
            const startDate = new Date(session.start_time);
            const endDate = session.end_time ? new Date(session.end_time) : new Date(); // Use current time if active

            // Helper to calculate duration string (simplified here)
            const durationMs = endDate.getTime() - startDate.getTime();
            const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
            const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            const durationString = `${durationHours}h ${durationMinutes}m`;
            
            return {
                SessionID: session._id.toString().slice(-4).toUpperCase(), // Placeholder ID
                Date: startDate.toLocaleDateString(),
                'Connector Used': session.connector_id?.type_name || 'N/A',
                Vehicle: 'Unknown EV', // Placeholder: Requires population/lookup
                'Started At': startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                'Ended At': session.end_time ? endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Active',
                Duration: durationString,
                'Total Energy Delivered(kWh)': (session.energy_delivered || 0).toFixed(2),
                'BookingID/Walk-in': session.booking_id ? session.booking_id.toString().slice(-4).toUpperCase() : 'Walk-in',
                'Charging Cost(LKR)': (session.total_cost || 0).toFixed(2),
                // 'Penalties Received': '0.00', // Requires complex transaction/penalty lookup
                'Total Payment': (session.total_cost || 0).toFixed(2),
                'Payment Status': session.payment_status.charAt(0).toUpperCase() + session.payment_status.slice(1),
                // 'Ratings Given': 'N/A', // Placeholder: Requires rating lookup
                'Issue Reported?': 'No', // Placeholder: Requires report lookup
                'Any actions taken to resolve': '', // Placeholder
                // 'Quick Actions': ['View Receipt']
            };
        });

        res.status(200).json({
            success: true,
            data: formattedSessions
        });

    } catch (error) {
        console.error('Error fetching charger sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching charger sessions.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get Bookings for a Specific Charger
const getBookingsByCharger = asyncHandler(async (req, res) => {
    const { chargerId } = req.params;
    const stationOwnerID = req.query.stationOwnerId || req.user?._id; 

    if (!stationOwnerID) {
        return res.status(401).json({ success: false, message: 'Authorization required.' });
    }

    try {
        // --- Security Check (Remains the same) ---
        const station = await PartneredChargingStation.findOne({
             "chargers._id": chargerId,
             station_owner_id: stationOwnerID
        }).select('_id').lean();

        if (!station) {
            return res.status(404).json({ success: false, message: 'Charger not found or access denied.' });
        }
        
        // --- 1. Fetch all bookings for this charger ---
        const bookings = await Booking.find({
            charger_id: chargerId,
        })
        .sort({ start_time: -1 }) // Newest bookings first
        .populate({
            path: 'connector_type_id',
            select: 'type_name current_type', // Get details for Connector field
            model: 'connector'
        })
        .lean(); 
        
        // 2. Fetch associated Session and Report IDs (concurrently)
        const bookingIds = bookings.map(b => b._id);
        
        const [sessionInfo, reportInfo] = await Promise.all([
            // Fetch Session IDs linked to these bookings (for 'SessionID' column)
            ChargingSession.find({ booking_id: { $in: bookingIds } }).select('booking_id _id').lean(),
            // Fetch Report info linked to these bookings (for 'Reported Issue?' column)
            BookingReport.find({ booking_id: { $in: bookingIds } }).select('booking_id status action').lean(),
        ]);

        const sessionMap = new Map(sessionInfo.map(s => [s.booking_id.toString(), s._id.toString().slice(-4).toUpperCase()]));
        const reportMap = new Map(reportInfo.map(r => [r.booking_id.toString(), r]));

        // 3. Format data for the frontend table
        const formattedBookings = bookings.map(booking => {
            const bookingIdString = booking._id.toString();
            const sessionID = sessionMap.get(bookingIdString) || '';
            const report = reportMap.get(bookingIdString);
            
            const bookedStart = new Date(booking.start_time);
            const bookedEnd = new Date(booking.end_time);

            return {
                BookingID: bookingIdString.slice(-4).toUpperCase(),
                SessionID: sessionID,
                'Booking Date': new Date(booking.booking_date).toLocaleDateString(),
                'Booked Slot': `${bookedStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${bookedEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
                
                // Fields for Charged/Completed sessions (may be blank for upcoming/cancelled)
                'Charging Started': booking.arrival_time ? new Date(booking.arrival_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
                'Charging Ended': booking.arrival_time && booking.status === 'completed' ? bookedEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '', // Simplified logic

                'Booking Status': booking.status.charAt(0).toUpperCase() + booking.status.slice(1),
                'Cancellation Time': booking.cancelled_at ? new Date(booking.cancelled_at).toLocaleString() : '',
                Reason: booking.cancellation_reason || '',
                
                // Cost fields
                'Charging Cost (LKR)': booking.total_cost ? booking.total_cost.toFixed(2) : '',
                // NOTE: 'Penalties Charged' requires a transaction lookup, placeholder used for now.
                'Penalties Charged': booking.booking_fee && booking.status === 'cancelled' ? booking.booking_fee.toFixed(2) : '',
                
                'Payment Status': booking.payment_status ? booking.payment_status.charAt(0).toUpperCase() + booking.payment_status.slice(1) : 'N/A',
                
                'Reported Issue?': report ? `Yes - ${report.status}` : 'No',
                'Any actions taken to resolve': report?.action || '',
                
                // Extra data for onRowClick access if needed
                _id: booking._id.toString() 
            };
        });

        res.status(200).json({
            success: true,
            data: formattedBookings
        });

    } catch (error) {
        console.error('Error fetching charger bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching charger bookings.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = {
    getChargerDetailsForStation,
    getSingleChargerProfileData,
    getSessionsByCharger,
    getBookingsByCharger
};