const EvOwner = require('../models/evOwnerModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const Transaction = require('../models/transactionModel');
const Booking = require('../models/bookingModel');
const ChargingSession = require('../models/chargingSessionModel');

/**
 * Get Admin Dashboard Statistics
 * Returns comprehensive dashboard data for admin overview
 */
const getAdminDashboardStats = async (req, res) => {
    console.log('\n========================================');
    console.log('🚀 Admin Dashboard Stats Request Started');
    console.log('========================================');
    console.log('⏰ Request Time:', new Date().toISOString());
    console.log('📍 Request URL:', req.originalUrl);
    console.log('🔧 Request Method:', req.method);
    
    try {
        // ====== STATIONS ======
        console.log('\n📊 Step 1: Fetching Stations Data...');
        const totalStations = await PartneredChargingStation.countDocuments();
        console.log('✅ Total stations found:', totalStations);
        
        const pendingStations = await PartneredChargingStation.countDocuments({
            station_status: 'processing'
        });
        console.log('✅ Pending stations found:', pendingStations);

        // ====== CHARGERS ======
        console.log('\n📊 Step 2: Fetching Chargers Data...');
        const stationsWithChargers = await PartneredChargingStation.find({}, 'chargers');
        console.log('✅ Stations with chargers retrieved:', stationsWithChargers.length);
        
        let totalChargers = 0;
        let faultedChargers = 0;
        let pendingChargerApprovals = 0;

        stationsWithChargers.forEach(station => {
            if (station.chargers && Array.isArray(station.chargers)) {
                // Count all chargers in the station's chargers array
                const stationChargerCount = station.chargers.length;
                totalChargers += stationChargerCount;
                
                // Count faulted and pending chargers
                station.chargers.forEach(charger => {
                    if (['unavailable', 'disabled_by_SO'].includes(charger.charger_status)) {
                        faultedChargers++;
                    }
                    
                    if (['processing', 'to_be_installed'].includes(charger.charger_status)) {
                        pendingChargerApprovals++;
                    }
                });
            }
        });
        console.log('✅ Chargers counted - Total:', totalChargers, 'Faulted:', faultedChargers, 'Pending:', pendingChargerApprovals);

        // ====== EV USERS ======
        console.log('\n📊 Step 3: Fetching Users Data...');
        const totalUsers = await EvOwner.countDocuments();
        console.log('✅ Total users found:', totalUsers);
        
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        console.log('📅 Last month date:', lastMonth.toISOString());
        
        const usersLastMonth = await EvOwner.countDocuments({
            createdAt: { $lte: lastMonth }
        });
        console.log('✅ Users from last month:', usersLastMonth);
        
        const userGrowthPercentage = usersLastMonth > 0 
            ? (((totalUsers - usersLastMonth) / usersLastMonth) * 100).toFixed(2)
            : "0.00";
        console.log('✅ User growth percentage:', userGrowthPercentage + '%');

        // ====== REVENUE ======
        console.log('\n📊 Step 4: Calculating Revenue...');
        const revenueResult = await Transaction.aggregate([
            {
                $match: {
                    status: 'completed',
                    type: { $in: ['booking_charge', 'charging_charge'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$amount' }
                }
            }
        ]);
        console.log('✅ Revenue aggregation result:', revenueResult);

        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
        console.log('✅ Total revenue calculated:', totalRevenue);

        // Revenue from last month
        console.log('\n📊 Step 5: Calculating Last Month Revenue...');
        const firstDayLastMonth = new Date();
        firstDayLastMonth.setMonth(firstDayLastMonth.getMonth() - 1);
        firstDayLastMonth.setDate(1);
        firstDayLastMonth.setHours(0, 0, 0, 0);

        const lastDayLastMonth = new Date();
        lastDayLastMonth.setDate(0);
        lastDayLastMonth.setHours(23, 59, 59, 999);
        
        console.log('📅 Last month date range:', {
            start: firstDayLastMonth.toISOString(),
            end: lastDayLastMonth.toISOString()
        });

        const revenueLastMonthResult = await Transaction.aggregate([
            {
                $match: {
                    status: 'completed',
                    type: { $in: ['booking_charge', 'charging_charge'] },
                    createdAt: {
                        $gte: firstDayLastMonth,
                        $lte: lastDayLastMonth
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$amount' }
                }
            }
        ]);

        const revenueLastMonth = revenueLastMonthResult.length > 0 ? revenueLastMonthResult[0].totalRevenue : 0;
        console.log('✅ Last month revenue:', revenueLastMonth);
        
        const revenueGrowthPercentage = revenueLastMonth > 0
            ? (((totalRevenue - revenueLastMonth) / revenueLastMonth) * 100).toFixed(2)
            : "0.00";
        console.log('✅ Revenue growth percentage:', revenueGrowthPercentage + '%');

        // ====== CHARGING SESSIONS ======
        console.log('\n📊 Step 6: Fetching Charging Sessions...');
        const totalSessions = await ChargingSession.countDocuments({
            status: 'completed'
        });
        console.log('✅ Total completed sessions:', totalSessions);

        const activeSessions = await ChargingSession.countDocuments({
            status: 'active'
        });
        console.log('✅ Active sessions:', activeSessions);

        // ====== BOOKINGS ======
        console.log('\n📊 Step 7: Fetching Bookings...');
        const completedBookings = await Booking.countDocuments({
            status: 'completed'
        });
        console.log('✅ Completed bookings:', completedBookings);

        const upcomingBookings = await Booking.countDocuments({
            status: 'upcoming'
        });
        console.log('✅ Upcoming bookings:', upcomingBookings);

        const cancelledBookings = await Booking.countDocuments({
            status: 'cancelled'
        });
        console.log('✅ Cancelled bookings:', cancelledBookings);

        // ====== BOOKING FEES ======
        console.log('\n📊 Step 8: Calculating Booking Fees...');
        const bookingFeesResult = await Transaction.aggregate([
            {
                $match: {
                    status: 'completed',
                    type: 'booking_charge'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);
        console.log('✅ Booking fees result:', bookingFeesResult);

        const totalBookingFees = bookingFeesResult.length > 0 ? bookingFeesResult[0].total : 0;
        const bookingFeesCount = bookingFeesResult.length > 0 ? bookingFeesResult[0].count : 0;
        console.log('✅ Total booking fees:', totalBookingFees, 'Count:', bookingFeesCount);

        // ====== CHARGING FEES ======
        console.log('\n📊 Step 9: Calculating Charging Fees...');
        const chargingFeesResult = await Transaction.aggregate([
            {
                $match: {
                    status: 'completed',
                    type: 'charging_charge'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        console.log('✅ Charging fees result:', chargingFeesResult);

        const totalChargingFees = chargingFeesResult.length > 0 ? chargingFeesResult[0].total : 0;
        console.log('✅ Total charging fees:', totalChargingFees);

        // ====== USER GROWTH DATA (Last 12 months) ======
        console.log('\n📊 Step 10: Calculating User Growth Trends...');
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        console.log('📅 Twelve months ago:', twelveMonthsAgo.toISOString());

        const userGrowthData = await EvOwner.aggregate([
            {
                $match: {
                    createdAt: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    newUsers: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        console.log('✅ User growth data points:', userGrowthData.length);

        let cumulativeUsers = usersLastMonth;
        const userGrowthWithActive = userGrowthData.map(item => {
            cumulativeUsers += item.newUsers;
            return {
                month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                newUsers: item.newUsers,
                activeUsers: cumulativeUsers
            };
        });
        console.log('✅ User growth with active users calculated:', userGrowthWithActive.length, 'months');

        // ====== REVENUE TRENDS (Last 12 months) ======
        console.log('\n📊 Step 11: Calculating Revenue Trends...');
        const revenueTrends = await Transaction.aggregate([
            {
                $match: {
                    status: 'completed',
                    type: { $in: ['booking_charge', 'charging_charge'] },
                    createdAt: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        type: '$type'
                    },
                    totalRevenue: { $sum: '$amount' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        console.log('✅ Revenue trends data points:', revenueTrends.length);

        const revenueByMonth = {};
        revenueTrends.forEach(item => {
            const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
            if (!revenueByMonth[key]) {
                revenueByMonth[key] = {
                    month: key,
                    bookingRevenue: 0,
                    chargingRevenue: 0,
                    totalRevenue: 0
                };
            }
            
            if (item._id.type === 'booking_charge') {
                revenueByMonth[key].bookingRevenue = Math.round(item.totalRevenue);
            } else if (item._id.type === 'charging_charge') {
                revenueByMonth[key].chargingRevenue = Math.round(item.totalRevenue);
            }
            revenueByMonth[key].totalRevenue += Math.round(item.totalRevenue);
        });
        console.log('✅ Revenue by month processed:', Object.keys(revenueByMonth).length, 'months');

        // ====== CHARGING SESSION TRENDS (Last 12 months) ======
        console.log('\n📊 Step 12: Calculating Session Trends...');
        const sessionTrends = await ChargingSession.aggregate([
            {
                $match: {
                    createdAt: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalSessions: { $sum: 1 },
                    withBooking: {
                        $sum: { $cond: [{ $ne: ['$booking_id', null] }, 1, 0] }
                    },
                    walkIns: {
                        $sum: { $cond: [{ $eq: ['$booking_id', null] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        console.log('✅ Session trends data points:', sessionTrends.length);

        // ====== APPROVALS ======
        const accountReactivations = 0;

        // ====== PREPARE RESPONSE ======
        console.log('\n📦 Step 13: Preparing Response Data...');
        const responseData = {
            success: true,
            data: {
                stats: {
                    stations: {
                        total: totalStations,
                        pending: pendingStations
                    },
                    chargers: {
                        total: totalChargers,
                        faulted: faultedChargers
                    },
                    users: {
                        total: totalUsers,
                        riskPercentage: userGrowthPercentage
                    },
                    revenue: {
                        total: Math.round(totalRevenue),
                        sessions: totalSessions,
                        bookingFees: revenueGrowthPercentage
                    }
                },
                trends: {
                    chargingSessions: {
                        approved: completedBookings,
                        bookings: bookingFeesCount,
                        walkIns: totalSessions - completedBookings
                    },
                    revenue: {
                        total: Math.round(totalRevenue),
                        sessions: Math.round(totalChargingFees),
                        bookingFees: Math.round(totalBookingFees)
                    }
                },
                userGrowth: userGrowthWithActive,
                revenueTrends: Object.values(revenueByMonth),
                sessionTrends: sessionTrends.map(item => ({
                    month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                    totalSessions: item.totalSessions,
                    withBooking: item.withBooking,
                    walkIns: item.walkIns
                })),
                approvals: {
                    stationApprovals: pendingStations,
                    chargerApprovals: pendingChargerApprovals,
                    accountReactivations: accountReactivations
                },
                summary: {
                    bookings: {
                        completed: completedBookings,
                        upcoming: upcomingBookings,
                        cancelled: cancelledBookings
                    },
                    sessions: {
                        total: totalSessions,
                        active: activeSessions
                    }
                }
            }
        };

        console.log('\n✅ Response Data Summary:');
        console.log('   - Stations:', responseData.data.stats.stations);
        console.log('   - Chargers:', responseData.data.stats.chargers);
        console.log('   - Users:', responseData.data.stats.users);
        console.log('   - Revenue:', responseData.data.stats.revenue);
        console.log('   - User Growth Points:', responseData.data.userGrowth.length);
        console.log('   - Revenue Trends Points:', responseData.data.revenueTrends.length);
        console.log('   - Session Trends Points:', responseData.data.sessionTrends.length);

        console.log('\n📤 Step 14: Sending Response...');
        res.setHeader('Content-Type', 'application/json');
        
        console.log('✅ Response status: 200');
        console.log('✅ Response sent successfully!');
        console.log('========================================');
        console.log('🎉 Admin Dashboard Request Completed');
        console.log('========================================\n');
        
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('\n❌ ========================================');
        console.error('❌ ERROR IN ADMIN DASHBOARD STATS');
        console.error('❌ ========================================');
        console.error('❌ Error Type:', error.name);
        console.error('❌ Error Message:', error.message);
        console.error('❌ Error Stack:');
        console.error(error.stack);
        console.error('❌ ========================================\n');
        
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = {
    getAdminDashboardStats
};