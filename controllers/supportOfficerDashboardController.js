const EvOwner = require('../models/evOwnerModel');
const PartneredChargingStation = require('../models/partneredChargingStationModel');
const StationReport = require('../models/stationReportModel');
const Discussion = require('../models/discussionModel');
const ChargingSession = require('../models/chargingSessionModel');
const Booking = require('../models/bookingModel');

/**
 * Get Support Office Dashboard Statistics
 * Returns comprehensive dashboard data for support office overview
 */
const getSupportOfficerDashboardStats = async (req, res) => {
    console.log('\n========================================');
    console.log('🚀 Support Office Dashboard Stats Request Started');
    console.log('========================================');
    console.log('⏰ Request Time:', new Date().toISOString());
    console.log('📍 Request URL:', req.originalUrl);
    console.log('🔧 Request Method:', req.method);
    
    try {
        // ====== STATION REPORTS ======
        console.log('\n📊 Step 1: Fetching Station Reports Data...');
        const totalReports = await StationReport.countDocuments();
        console.log('✅ Total reports found:', totalReports);
        
        const underReviewReports = await StationReport.countDocuments({
            status: 'under-review'
        });
        console.log('✅ Under review reports found:', underReviewReports);

        const resolvedReports = await StationReport.countDocuments({
            status: 'resolved'
        });
        console.log('✅ Resolved reports found:', resolvedReports);

        const rejectedReports = await StationReport.countDocuments({
            status: 'rejected'
        });
        console.log('✅ Rejected reports found:', rejectedReports);

        // Reports by category
        console.log('\n📊 Step 2: Fetching Reports by Category...');
        const reportsByCategory = await StationReport.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
        console.log('✅ Reports by category:', reportsByCategory);

        // Reports by charger (with station and charger names)
        console.log('\n📊 Step 2.5: Fetching Reports by Charger...');
        const reportsByCharger = await StationReport.aggregate([
            {
                $group: {
                    _id: {
                        station_id: '$station_id',
                        charger_id: '$charger_id'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 10
            }
        ]);

        // Populate station and charger names
        const reportsWithNames = await Promise.all(
            reportsByCharger.map(async (report) => {
                try {
                    const station = await PartneredChargingStation.findById(report._id.station_id);
                    if (!station) {
                        return {
                            stationName: 'Unknown Station',
                            chargerName: 'Unknown Charger',
                            reportCount: report.count
                        };
                    }

                    const charger = station.chargers.id(report._id.charger_id);
                    const chargerName = charger ? charger.charger_name : 'Unknown Charger';

                    return {
                        stationName: station.station_name,
                        chargerName: chargerName,
                        displayName: `${station.station_name} - ${chargerName}`,
                        reportCount: report.count
                    };
                } catch (error) {
                    console.error('Error fetching station/charger details:', error);
                    return {
                        stationName: 'Unknown Station',
                        chargerName: 'Unknown Charger',
                        displayName: 'Unknown',
                        reportCount: report.count
                    };
                }
            })
        );
        console.log('✅ Reports by charger with names:', reportsWithNames);

        // ====== DISCUSSIONS ======
        console.log('\n📊 Step 3: Fetching Discussions Data...');
        const totalDiscussions = await Discussion.countDocuments();
        console.log('✅ Total discussions found:', totalDiscussions);

        const flaggedDiscussions = await Discussion.countDocuments({
            flagged_status: true
        });
        console.log('✅ Flagged discussions found:', flaggedDiscussions);

        const pinnedDiscussions = await Discussion.countDocuments({
            isPinned: true
        });
        console.log('✅ Pinned discussions found:', pinnedDiscussions);

        // Discussion flags breakdown
        console.log('\n📊 Step 4: Calculating Discussion Flags Breakdown...');
        const flagsBreakdown = await Discussion.aggregate([
            {
                $project: {
                    spam: '$flagged_count.spam',
                    harassment: '$flagged_count.harassment',
                    other: '$flagged_count.other'
                }
            },
            {
                $group: {
                    _id: null,
                    totalSpam: { $sum: '$spam' },
                    totalHarassment: { $sum: '$harassment' },
                    totalOther: { $sum: '$other' }
                }
            }
        ]);
        console.log('✅ Flags breakdown:', flagsBreakdown);

        const flagsData = flagsBreakdown.length > 0 ? flagsBreakdown[0] : {
            totalSpam: 0,
            totalHarassment: 0,
            totalOther: 0
        };

        // ====== DISCUSSIONS BY DAY (Last 7 days) ======
        console.log('\n📊 Step 4.5: Calculating Discussions by Day...');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        console.log('📅 Seven days ago:', sevenDaysAgo.toISOString());

        const discussionsByDay = await Discussion.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                        dayOfWeek: { $dayOfWeek: '$createdAt' }
                    },
                    total: { $sum: 1 },
                    flagged: {
                        $sum: { $cond: ['$flagged_status', 1, 0] }
                    },
                    pinned: {
                        $sum: { $cond: ['$isPinned', 1, 0] }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);
        console.log('✅ Discussions by day data points:', discussionsByDay.length);

        // Map day of week number to name
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Initialize all 7 days with zero counts
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayOfWeek = date.getDay();
            
            last7Days.push({
                date: date.toISOString().split('T')[0],
                day: dayNames[dayOfWeek],
                dayOfWeek: dayOfWeek,
                approved: 0,
                flagged: 0,
                pinned: 0,
                total: 0
            });
        }

        // Fill in actual data from database
        discussionsByDay.forEach(item => {
            const date = new Date(item._id.year, item._id.month - 1, item._id.day);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayIndex = last7Days.findIndex(d => d.date === dateStr);
            if (dayIndex !== -1) {
                last7Days[dayIndex].total = item.total;
                last7Days[dayIndex].flagged = item.flagged;
                last7Days[dayIndex].pinned = item.pinned;
                last7Days[dayIndex].approved = item.total - item.flagged;
            }
        });

        console.log('✅ Last 7 days discussion data prepared:', last7Days);

        // ====== MOST ACTIVE USERS ======
        console.log('\n📊 Step 4.6: Calculating Most Active Users...');
        
        // Get all discussions with their comments
        const allDiscussions = await Discussion.find({}).select('user comments flagged_status');
        
        // Calculate user activity
        const userActivityMap = {};
        
        allDiscussions.forEach(discussion => {
            const username = discussion.user;
            
            // Initialize user if not exists
            if (!userActivityMap[username]) {
                userActivityMap[username] = {
                    name: username,
                    posts: 0,
                    comments: 0,
                    rejected: 0,
                    totalActivity: 0
                };
            }
            
            // Count discussion post
            userActivityMap[username].posts += 1;
            
            // Count if flagged (rejected)
            if (discussion.flagged_status) {
                userActivityMap[username].rejected += 1;
            }
            
            // Count comments by this user
            if (discussion.comments && Array.isArray(discussion.comments)) {
                discussion.comments.forEach(comment => {
                    if (comment.user === username) {
                        userActivityMap[username].comments += 1;
                    }
                });
            }
        });
        
        // Calculate total activity and convert to array
        const usersArray = Object.values(userActivityMap).map(user => ({
            ...user,
            totalActivity: user.posts + user.comments
        }));
        
        // Sort by total activity and get top 5
        const topUsers = usersArray
            .sort((a, b) => b.totalActivity - a.totalActivity)
            .slice(0, 5)
            .map((user, index) => ({
                name: user.name,
                posts: user.posts + user.comments, // Total posts (discussions + comments)
                rejected: user.rejected,
                rank: index + 1
            }));
        
        console.log('✅ Top 5 active users:', topUsers);

        // ====== STATIONS & CHARGERS STATUS ======
        console.log('\n📊 Step 5: Fetching Stations Status...');
        const openStations = await PartneredChargingStation.countDocuments({
            station_status: 'open'
        });
        console.log('✅ Open stations:', openStations);

        const unavailableStations = await PartneredChargingStation.countDocuments({
            station_status: 'unavailable'
        });
        console.log('✅ Unavailable stations:', unavailableStations);

        const disabledStations = await PartneredChargingStation.countDocuments({
            station_status: 'disabled_by_SO'
        });
        console.log('✅ Disabled stations:', disabledStations);

        // Chargers status
        console.log('\n📊 Step 6: Fetching Chargers Status...');
        const stationsWithChargers = await PartneredChargingStation.find({}, 'chargers');
        console.log('✅ Stations with chargers retrieved:', stationsWithChargers.length);
        
        let openChargers = 0;
        let unavailableChargers = 0;
        let disabledChargers = 0;
        let faultedChargers = 0;

        stationsWithChargers.forEach(station => {
            if (station.chargers && Array.isArray(station.chargers)) {
                station.chargers.forEach(charger => {
                    if (charger.charger_status === 'open') {
                        openChargers++;
                    } else if (charger.charger_status === 'unavailable') {
                        unavailableChargers++;
                        faultedChargers++;
                    } else if (charger.charger_status === 'disabled_by_SO') {
                        disabledChargers++;
                        faultedChargers++;
                    }
                });
            }
        });
        console.log('✅ Chargers status - Open:', openChargers, 'Unavailable:', unavailableChargers, 'Disabled:', disabledChargers);

        console.log('\n📊 Step 6.5: Counting Total Connectors...');

        let totalConnectors = 0;
        let availableConnectors = 0;
        let unavailableConnectors = 0;

        stationsWithChargers.forEach(station => {
            if (station.chargers && Array.isArray(station.chargers)) {
                station.chargers.forEach(charger => {
                    if (charger.connector_types && Array.isArray(charger.connector_types)) {
                        charger.connector_types.forEach(connector => {
                            totalConnectors++;
                            if (connector.status === 'available') {
                                availableConnectors++;
                            } else if (connector.status === 'unavailable') {
                                unavailableConnectors++;
                            }
                        });
                    }
                });
            }
        });

        console.log('✅ Total connectors:', totalConnectors);
        console.log('✅ Available connectors:', availableConnectors);
        console.log('✅ Unavailable connectors:', unavailableConnectors);

        // ====== ACTIVE USERS ======
        console.log('\n📊 Step 7: Fetching Active Users Data...');
        const totalUsers = await EvOwner.countDocuments();
        console.log('✅ Total users found:', totalUsers);

        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        const newUsersLastMonth = await EvOwner.countDocuments({
            createdAt: { $gte: lastMonth }
        });
        console.log('✅ New users last month:', newUsersLastMonth);

        // ====== CHARGING SESSIONS ======
        console.log('\n📊 Step 8: Fetching Charging Sessions...');
        const activeSessions = await ChargingSession.countDocuments({
            status: 'active'
        });
        console.log('✅ Active sessions:', activeSessions);

        const completedSessions = await ChargingSession.countDocuments({
            status: 'completed'
        });
        console.log('✅ Completed sessions:', completedSessions);

        // ====== BOOKINGS ======
        console.log('\n📊 Step 9: Fetching Bookings...');
        const upcomingBookings = await Booking.countDocuments({
            status: 'upcoming'
        });
        console.log('✅ Upcoming bookings:', upcomingBookings);

        const completedBookings = await Booking.countDocuments({
            status: 'completed'
        });
        console.log('✅ Completed bookings:', completedBookings);

        const cancelledBookings = await Booking.countDocuments({
            status: 'cancelled'
        });
        console.log('✅ Cancelled bookings:', cancelledBookings);

        // ====== REPORTS TRENDS (Last 12 months) ======
        console.log('\n📊 Step 10: Calculating Reports Trends...');
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        console.log('📅 Twelve months ago:', twelveMonthsAgo.toISOString());

        const reportsTrends = await StationReport.aggregate([
            {
                $match: {
                    createdAt: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        status: '$status'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        console.log('✅ Reports trends data points:', reportsTrends.length);

        const reportsByMonth = {};
        reportsTrends.forEach(item => {
            const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
            if (!reportsByMonth[key]) {
                reportsByMonth[key] = {
                    month: key,
                    underReview: 0,
                    resolved: 0,
                    rejected: 0,
                    total: 0
                };
            }
            
            if (item._id.status === 'under-review') {
                reportsByMonth[key].underReview = item.count;
            } else if (item._id.status === 'resolved') {
                reportsByMonth[key].resolved = item.count;
            } else if (item._id.status === 'rejected') {
                reportsByMonth[key].rejected = item.count;
            }
            reportsByMonth[key].total += item.count;
        });
        console.log('✅ Reports by month processed:', Object.keys(reportsByMonth).length, 'months');

        // ====== DISCUSSION TRENDS (Last 12 months) ======
        console.log('\n📊 Step 11: Calculating Discussion Trends...');
        const discussionTrends = await Discussion.aggregate([
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
                    totalDiscussions: { $sum: 1 },
                    flaggedCount: {
                        $sum: { $cond: ['$flagged_status', 1, 0] }
                    },
                    totalComments: {
                        $sum: { $size: '$comments' }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        console.log('✅ Discussion trends data points:', discussionTrends.length);

        // ====== STATION PERFORMANCE ======
        console.log('\n📊 Step 12: Calculating Station Performance...');
        const stationsWithReports = await StationReport.aggregate([
            {
                $group: {
                    _id: '$station_id',
                    reportCount: { $sum: 1 },
                    underReviewCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'under-review'] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { reportCount: -1 }
            },
            {
                $limit: 10
            }
        ]);
        console.log('✅ Top stations with reports:', stationsWithReports.length);

        // ====== RECENT ACTIVITIES ======
        console.log('\n📊 Step 13: Fetching Recent Activities...');
        const recentReports = await StationReport.find({
            status: 'under-review'
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('category station_id user_id createdAt');
        console.log('✅ Recent reports fetched:', recentReports.length);

        const recentDiscussions = await Discussion.find({
            flagged_status: true
        })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('title user flagged_count updatedAt');
        console.log('✅ Recent flagged discussions fetched:', recentDiscussions.length);

        // ====== RESPONSE TIME METRICS ======
        console.log('\n📊 Step 14: Calculating Response Time Metrics...');
        const resolvedReportsWithTime = await StationReport.find({
            status: { $in: ['resolved', 'rejected'] },
            resolved_at: { $exists: true }
        }).select('createdAt resolved_at');

        let totalResponseTime = 0;
        let responseTimeCount = 0;

        resolvedReportsWithTime.forEach(report => {
            if (report.resolved_at && report.createdAt) {
                const responseTime = report.resolved_at - report.createdAt;
                totalResponseTime += responseTime;
                responseTimeCount++;
            }
        });

        const avgResponseTimeHours = responseTimeCount > 0 
            ? Math.round((totalResponseTime / responseTimeCount) / (1000 * 60 * 60))
            : 0;
        console.log('✅ Average response time:', avgResponseTimeHours, 'hours');

        // ====== PREPARE RESPONSE ======
        console.log('\n📦 Step 15: Preparing Response Data...');
        const responseData = {
            success: true,
            data: {
                stats: {
                    reports: {
                        total: totalReports,
                        underReview: underReviewReports,
                        resolved: resolvedReports,
                        rejected: rejectedReports
                    },
                    discussions: {
                        total: totalDiscussions,
                        flagged: flaggedDiscussions,
                        pinned: pinnedDiscussions
                    },
                    stations: {
                        open: openStations,
                        unavailable: unavailableStations,
                        disabled: disabledStations
                    },
                    chargers: {
                        open: openChargers,
                        unavailable: unavailableChargers,
                        disabled: disabledChargers,
                        faulted: faultedChargers,
                        totalConnectors: totalConnectors,
                        availableConnectors: availableConnectors,
                        unavailableConnectors: unavailableConnectors
                    }
                },
                metrics: {
                    users: {
                        total: totalUsers,
                        newLastMonth: newUsersLastMonth
                    },
                    sessions: {
                        active: activeSessions,
                        completed: completedSessions
                    },
                    bookings: {
                        upcoming: upcomingBookings,
                        completed: completedBookings,
                        cancelled: cancelledBookings
                    },
                    responseTime: {
                        averageHours: avgResponseTimeHours,
                        reportsSampled: responseTimeCount
                    }
                },
                trends: {
                    reportsByCategory: reportsByCategory.map(cat => ({
                        category: cat._id,
                        count: cat.count
                    })),
                    reportsByCharger: reportsWithNames,
                    flagsBreakdown: {
                        spam: flagsData.totalSpam,
                        harassment: flagsData.totalHarassment,
                        other: flagsData.totalOther
                    }
                },
                topUsers: topUsers, // NEW: Most active users
                reportsTrends: Object.values(reportsByMonth),
                discussionTrends: {
                    total: totalDiscussions,
                    flagged: flaggedDiscussions,
                    pinned: pinnedDiscussions,
                    dailyData: last7Days,
                    monthlyData: discussionTrends.map(item => ({
                        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                        totalDiscussions: item.totalDiscussions,
                        flaggedCount: item.flaggedCount,
                        totalComments: item.totalComments
                    }))
                },
                stationPerformance: stationsWithReports.map(station => ({
                    stationId: station._id,
                    totalReports: station.reportCount,
                    pendingReports: station.underReviewCount
                })),
                recentActivities: {
                    reports: recentReports,
                    discussions: recentDiscussions
                }
            }
        };

        console.log('\n✅ Response Data Summary:');
        console.log('   - Reports:', responseData.data.stats.reports);
        console.log('   - Discussions:', responseData.data.stats.discussions);
        console.log('   - Stations:', responseData.data.stats.stations);
        console.log('   - Chargers:', responseData.data.stats.chargers);
        console.log('   - Top Users:', responseData.data.topUsers.length);
        console.log('   - Reports Trends Points:', responseData.data.reportsTrends.length);
        console.log('   - Discussion Daily Data Points:', responseData.data.discussionTrends.dailyData.length);
        console.log('   - Discussion Monthly Data Points:', responseData.data.discussionTrends.monthlyData.length);
        console.log('   - Station Performance Points:', responseData.data.stationPerformance.length);

        console.log('\n📤 Step 16: Sending Response...');
        res.setHeader('Content-Type', 'application/json');
        
        console.log('✅ Response status: 200');
        console.log('✅ Response sent successfully!');
        console.log('========================================');
        console.log('🎉 Support Office Dashboard Request Completed');
        console.log('========================================\n');
        
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('\n❌ ========================================');
        console.error('❌ ERROR IN SUPPORT OFFICE DASHBOARD STATS');
        console.error('❌ ========================================');
        console.error('❌ Error Type:', error.name);
        console.error('❌ Error Message:', error.message);
        console.error('❌ Error Stack:');
        console.error(error.stack);
        console.error('❌ ========================================\n');
        
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch support office dashboard statistics',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = {
    getSupportOfficerDashboardStats
};