const asyncHandler = require('express-async-handler');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const ChargingSession = require('../models/chargingSessionModel');
const StationOwner = require('../models/stationOwnerModel');
const Booking = require('../models/bookingModel');
const StationReport = require('../models/stationReportModel');
const ChargerReport = require('../models/chargerReportModel');
const BookingReport = require('../models/bookingReportModel');

// Helper to calculate start/end of today in IST (Sri Lanka standard time)
const getTodayDateRange = () => {
    // Current time in UTC
    const now = new Date();
    
    // Calculate IST offset (UTC+5:30) in minutes
    const IST_OFFSET_MINUTES = 330; 
    
    // Create Date objects for the start and end of TODAY in IST
    const startOfTodayIST = new Date(now);
    startOfTodayIST.setHours(0, 0, 0, 0); // Start of day in local time
    startOfTodayIST.setMinutes(startOfTodayIST.getMinutes() - startOfTodayIST.getTimezoneOffset()); // Adjust to UTC
    startOfTodayIST.setMinutes(startOfTodayIST.getMinutes() + IST_OFFSET_MINUTES); // Adjust to IST (00:00:00)

    const endOfTodayIST = new Date(startOfTodayIST);
    endOfTodayIST.setDate(startOfTodayIST.getDate() + 1); // End of day in IST (23:59:59)

    return { start: startOfTodayIST, end: endOfTodayIST };
};

const getOwnerDashboardStats = asyncHandler(async (req, res) => {
    
    const todayRange = getTodayDateRange();

    try {

        const stationOwnerID = req.query.stationOwnerId || req.user?._id; 

        if (!stationOwnerID) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required(Owner Dashboard)'
            });
        }

        // Verify station owner exists
        const owner = await StationOwner.findById(stationOwnerID);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: 'Station owner not found'
            });
        }

        // --- 1. Fetch Station and Charger Counts ---
        const ownerStations = await PartneredChargingStation.find({ station_owner_id: stationOwnerID })
            .select('chargers')
            .lean();
        
        const allChargers = ownerStations.flatMap(s => s.chargers);
        const totalStations = ownerStations.length;
        const totalChargers = allChargers.length;

        // --- 2. Calculate Today's Stats and Active Sessions (Concurrent Aggregations) ---
        
        const [sessionStats] = await Promise.all([
            ChargingSession.aggregate([
                { 
                    $match: { 
                        station_id: { $in: ownerStations.map(s => s._id) },
                        // Sessions that ended today, or started before today and are active, or started today.
                        $or: [
                            { createdAt: { $gte: todayRange.start, $lt: todayRange.end } },
                            { status: 'active' } // Check for active sessions regardless of start date
                        ]
                    } 
                },
                {
                    $group: {
                        _id: null,
                        totalSessionsToday: { 
                            $sum: { 
                                $cond: [
                                    { $gte: ["$start_time", todayRange.start] }, 
                                    1, 
                                    0 
                                ]
                            }
                        },
                        activeSessions: { 
                            $sum: { 
                                $cond: [
                                    { $eq: ["$status", "active"] }, 
                                    1, 
                                    0 
                                ]
                            }
                        },
                        totalEnergyToday: { 
                            $sum: { 
                                $cond: [
                                    { $gte: ["$start_time", todayRange.start] }, 
                                    "$energy_delivered", 
                                    0 
                                ]
                            }
                        },
                        totalRevenueToday: { 
                            $sum: { 
                                $cond: [
                                    { $gte: ["$start_time", todayRange.start] }, 
                                    "$total_cost", 
                                    0 
                                ]
                            }
                        }
                    }
                }
            ])
        ]);
        
        const statsResult = sessionStats[0] || {};

        // --- 3. Format and Respond ---

        const formattedStats = {
            totalStations: totalStations.toString().padStart(2, '0'),
            totalChargers: totalChargers.toString().padStart(2, '0'),
            sessionsToday: (statsResult.totalSessionsToday || 0).toString().padStart(2, '0'),
            activeSessions: (statsResult.activeSessions || 0).toString().padStart(2, '0'),
            electricityToday: `${(statsResult.totalEnergyToday || 0).toFixed(2)} kWh`,
            revenueToday: `LKR ${(statsResult.totalRevenueToday / 1000 || 0).toFixed(2)}K`, // Divide by 1000 for K
            // Assuming you have a separate aggregation for the revenue trend:
            // revenueTrend: { value: 8.3, label: 'vs last week' } 
        };

        res.status(200).json({
            success: true,
            message: 'Dashboard stats fetched successfully.',
            data: formattedStats
        });

    } catch (error) {
        console.error('Error fetching owner dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard stats.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getConnectorStatusChartData = asyncHandler(async (req, res) => {
    
    const now = new Date();

    try {
        const stationOwnerID = req.query.stationOwnerId || req.user?._id; 

        if (!stationOwnerID) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required(Owner Dashboard)'
            });
        }

        // 1. Get IDs of all stations owned by the user
        const ownerStations = await PartneredChargingStation.find({ station_owner_id: stationOwnerID })
            .select('_id chargers.connector_types')
            .lean();

        const stationIds = ownerStations.map(s => s._id);

        // Calculate TOTAL CONNECTORS owned (including those unavailable/disabled in the schema)
        let totalConnectors = 0;
        ownerStations.forEach(station => {
            station.chargers.forEach(charger => {
                totalConnectors += charger.connector_types.length;
            });
        });

        // --- 2. Find Charging Connectors ---
        // Find all unique connector IDs currently in an 'active' charging session
        const chargingSessions = await ChargingSession.find({
            station_id: { $in: stationIds },
            status: 'active'
        }).distinct('connector_id'); // Returns array of unique ObjectIds

        const chargingCount = chargingSessions.length;

        // --- 3. Find Reserved Connectors ---
        // Find all unique connector IDs that are 'upcoming' AND fall within the current minute
        const reservedBookings = await Booking.find({
            charging_station_id: { $in: stationIds },
            status: 'upcoming',
            // CRITICAL CHECK: Booking is currently active in its reserved time slot
            start_time: { $lte: now },
            end_time: { $gt: now }
        }).distinct('connector_type_id'); // Use connector_type_id field

        // Filter out any connectors that are already in a charging session
        const reservedConnectors = reservedBookings.filter(reservedId => 
            !chargingSessions.some(chargingId => chargingId.equals(reservedId))
        );
        const reservedCount = reservedConnectors.length;


        // --- 4. Calculate Free Connectors ---
        const occupiedCount = chargingCount + reservedCount;
        let freeCount = totalConnectors - occupiedCount;
        
        // Ensure free count is not negative (shouldn't happen, but defensive)
        if (freeCount < 0) {
            console.warn(`Connector count mismatch for owner ${stationOwnerID}. Free count calculated negative.`);
            freeCount = 0;
        }

        // --- 5. Format and Respond ---
        const chartData = [
            { name: 'Charging', value: chargingCount },
            { name: 'Reserved', value: reservedCount },
            { name: 'Free', value: freeCount },
        ];

        res.status(200).json({
            success: true,
            message: 'Connector status fetched successfully.',
            data: chartData
        });

    } catch (error) {
        console.error('Error fetching connector status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching connector status chart data.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getFaultReportsStatus = asyncHandler(async (req, res) => {
    
    try {

        const stationOwnerID = req.query.stationOwnerId || req.user?._id; 

        if (!stationOwnerID) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required(Owner Dashboard - Reports)'
            });
        }
        
        // 1. Get all station IDs owned by the user
        const ownerStations = await PartneredChargingStation.find({ station_owner_id: stationOwnerID })
            .select('_id')
            .lean();

        const stationIds = ownerStations.map(s => s._id);

        // 1.a Get all booking IDs for the owner's stations
        const ownerBookings = await Booking.find({ charging_station_id: { $in: stationIds } })
            .select('_id')
            .lean();
            
        const bookingIds = ownerBookings.map(b => b._id);
        
        // Define the status groups
        const statusGroups = {
            'under-review': 'Reviewing', // Frontend label
            'resolved': 'Resolved',       // Frontend label
            'rejected': 'Rejected'        // Frontend label
        };

        // Aggregation pipeline to count reports by status for a given model
        const aggregateReports = async (Model, matchField, ids) => {
            return Model.aggregate([
                // Match reports belonging to the owner's stations
                { $match: { [matchField]: { $in: ids } } },
                // Group by status and count
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);
        };

        // 2. Run concurrent aggregations on all three models
        const [stationResults, chargerResults, bookingResults] = await Promise.all([
            aggregateReports(StationReport, 'station_id', stationIds),
            aggregateReports(ChargerReport, 'station_id', stationIds),
            aggregateReports(BookingReport, 'booking_id', bookingIds),
        ]);

        // 3. Combine counts from all report types
        const totalCounts = {};

        [...stationResults, ...chargerResults, ...bookingResults].forEach(item => {
            const statusKey = statusGroups[item._id];
            if (statusKey) {
                totalCounts[statusKey] = (totalCounts[statusKey] || 0) + item.count;
            }
        });

        // 4. Format for Pie Chart
        const chartData = Object.entries(statusGroups).map(([dbStatus, feStatus]) => ({
            name: feStatus,
            value: totalCounts[feStatus] || 0
        }));


        res.status(200).json({
            success: true,
            message: 'Fault report status fetched successfully.',
            data: chartData
        });

    } catch (error) {
        console.error('Error fetching fault report status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching fault report chart data.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getStackedSessionsChartData = asyncHandler(async (req, res) => {

    const range = parseInt(req.query.range, 10) || 14; // Default to 14 days

    if (![7, 14, 30].includes(range)) {
        return res.status(400).json({ success: false, message: 'Invalid date range specified.' });
    }

    try {

        const stationOwnerID = req.query.stationOwnerId || req.user?._id; 

        if (!stationOwnerID) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required(Owner Dashboard - Reports)'
            });
        }

        // Calculate the date range (Start of day 'range' days ago)
        const endDate = new Date();
        const startDate = new Date();
        
        startDate.setDate(endDate.getDate() - range);
        startDate.setHours(0, 0, 0, 0); // Start of day

        // 1. Get all station IDs owned by the user
        const ownerStations = await PartneredChargingStation.find({ station_owner_id: stationOwnerID })
            .select('_id')
            .lean();

        const stationIds = ownerStations.map(s => s._id);

        // 2. Aggregate sessions by date, categorizing them as 'bookings' or 'walkins'
        const sessionsByDate = await ChargingSession.aggregate([
            {
                // Match by station ID and date range
                $match: {
                    station_id: { $in: stationIds },
                    start_time: { $gte: startDate, $lt: endDate },
                    status: { $in: ['active', 'completed'] } // Consider only meaningful sessions
                }
            },
            {
                // Group by date, and count bookings vs walk-ins
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$start_time" }
                    },
                    bookings: {
                        $sum: {
                            $cond: [
                                // Check if the booking_id is of type 'objectId'
                                // This reliably identifies documents where the field holds a valid reference.
                                { $eq: [{ $type: "$booking_id" }, "objectId"] }, 
                                1, 
                                0
                            ]
                        }
                    },
                    walkins: {
                        $sum: {
                            $cond: [
                                // Check if the booking_id is NOT of type 'objectId'
                                { $ne: [{ $type: "$booking_id" }, "objectId"] }, 
                                1, 
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } } // Sort by date ascending
        ]);

        // 3. Post-process to fill missing dates and format for the chart
        const chartData = {};
        sessionsByDate.forEach(item => {
            chartData[item._id] = {
                bookings: item.bookings,
                walkins: item.walkins
            };
        });

        const finalChartData = [];
        let currentDate = new Date(startDate);
        
        while (currentDate < endDate) {
            const dateKey = currentDate.toISOString().slice(0, 10); // YYYY-MM-DD
            const chartLabel = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            const counts = chartData[dateKey] || { bookings: 0, walkins: 0 };
            
            finalChartData.push({
                date: chartLabel,
                bookings: counts.bookings,
                walkins: counts.walkins,
            });
            
            // Move to the next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.status(200).json({
            success: true,
            message: 'Stacked session data fetched successfully.',
            data: finalChartData
        });

    } catch (error) {
        console.error('Error fetching stacked session data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stacked session chart data.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const getOverviewChartData = asyncHandler(async (req, res) => {
    
    const range = parseInt(req.query.range, 10) || 14;

    if (![7, 14, 30].includes(range)) {
        return res.status(400).json({ success: false, message: 'Invalid date range specified.' });
    }

    try {

        const stationOwnerID = req.query.stationOwnerId || req.user?._id; 

        if (!stationOwnerID) {
            return res.status(400).json({
                success: false,
                message: 'Station owner ID is required(Owner Dashboard - Overview Chart)'
            });
        }

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - range);
        startDate.setHours(0, 0, 0, 0);

        const ownerStations = await PartneredChargingStation.find({ station_owner_id: stationOwnerID })
            .select('_id')
            .lean();
        const stationIds = ownerStations.map(s => s._id);

        const dailyStats = await ChargingSession.aggregate([
            {
                $match: {
                    station_id: { $in: stationIds },
                    start_time: { $gte: startDate, $lt: endDate },
                    status: { $in: ['active', 'completed'] },
                    // Ensure energy_delivered and total_cost are not null for accurate sums
                    energy_delivered: { $ne: null },
                    total_cost: { $ne: null }
                }
            },
            {
                // Group sessions by the date they started
                $group: {
                    _id: {
                        $dateToString: { 
                            format: "%Y-%m-%d", 
                            date: "$start_time"
                            // Assuming you added TIMEZONE_IST to match local day grouping
                        }
                    },
                    totalSessions: { $sum: 1 },
                    totalElectricityKWh: { $sum: "$energy_delivered" },
                    totalIncomeLKR: { $sum: "$total_cost" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // --- Post-processing: Fill missing dates and format ---
        const dailyDataMap = {};
        dailyStats.forEach(item => {
            dailyDataMap[item._id] = item;
        });

        const finalChartData = [];
        let currentDate = new Date(startDate);
        
        while (currentDate < endDate) {
            const dateKey = currentDate.toISOString().slice(0, 10);
            const chartLabel = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            const stats = dailyDataMap[dateKey];
            
            finalChartData.push({
                day: chartLabel,
                sessions: stats?.totalSessions || 0,
                // Convert kWh to MWh (divide by 1000) and format to 2 decimal places
                electricity: parseFloat(((stats?.totalElectricityKWh || 0) / 1000).toFixed(2)), 
                income: stats?.totalIncomeLKR || 0,
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.status(200).json({
            success: true,
            message: 'Overview chart data fetched successfully.',
            data: finalChartData
        });

    } catch (error) {
        console.error('Error fetching overview chart data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching overview chart data.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = {
    getOwnerDashboardStats,
    getConnectorStatusChartData,
    getFaultReportsStatus,
    getStackedSessionsChartData,
    getOverviewChartData
};