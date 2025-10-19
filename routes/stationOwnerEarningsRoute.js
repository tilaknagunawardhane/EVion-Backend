const express = require('express');
const router = express.Router();
const StationEarnings = require('../models/stationEarningsModel');
const PayoutBatch = require('../models/payoutBatchModel');
const StationOwner = require('../models/stationOwnerModel');
const ChargingSession = require('../models/chargingSessionModel');
const Booking = require('../models/bookingModel');
const mongoose = require('mongoose');

// Get station owner earnings history
router.get('/earnings/:stationOwnerId', async (req, res) => {
    try {
        const { stationOwnerId } = req.params;

        const stationOwner = await StationOwner.findById(stationOwnerId);
        if (!stationOwner) {
            return res.status(404).json({
                success: false,
                message: 'Access denied'
            });
        }

        const earnings = await StationEarnings.find({
            station_owner_id: stationOwnerId
        })
        .sort({ year: -1, month: -1, createdAt: -1 })
        .populate('station_id', 'station_name address')
        .populate('booking_id', 'booking_date start_time end_time')
        .populate('charging_session_id', 'start_time end_time energy_delivered total_cost')
        .populate('payout_batch_id', 'batch_number status');

        // Group by month/year for summary
        const monthlySummary = earnings.reduce((acc, earning) => {
            const key = `${earning.year}-${String(earning.month).padStart(2, '0')}`;
            if (!acc[key]) {
                acc[key] = {
                    month: earning.month,
                    year: earning.year,
                    total_earnings: 0,
                    total_commission: 0,
                    net_earnings: 0,
                    payout_status: earning.payout_status,
                    earnings_count: 0,
                    earnings: []
                };
            }
            acc[key].total_earnings += earning.gross_amount;
            acc[key].total_commission += earning.platform_commission;
            acc[key].net_earnings += earning.net_amount;
            acc[key].earnings_count += 1;
            acc[key].earnings.push(earning);
            return acc;
        }, {});

        res.json({
            success: true,
            earnings: Object.values(monthlySummary),
            detailed_earnings: earnings
        });
    } catch (error) {
        console.error('Error fetching earnings:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get current month earnings summary
router.get('/earnings/current/:stationOwnerId', async (req, res) => {
    try {
        console.log('Fetching current month earnings');
        const { stationOwnerId } = req.params;
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const stationOwner = await StationOwner.findById(stationOwnerId);
        if (!stationOwner) {
            return res.status(404).json({
                success: false,
                message: 'Access denied'
            });
        }

        const earnings = await StationEarnings.find({
            station_owner_id: stationOwnerId,
            month: currentMonth,
            year: currentYear
        })
        .populate('station_id', 'station_name')
        .populate('booking_id', 'booking_date')
        .populate('charging_session_id', 'start_time end_time');

        const summary = {
            total_gross: 0,
            total_commission: 0,
            total_net: 0,
            pending_earnings: 0,
            paid_earnings: 0,
            earnings_count: earnings.length,
            breakdown_by_type: {
                booking_fee: { count: 0, amount: 0 },
                charging_fee: { count: 0, amount: 0 }
            },
            breakdown_by_station: {}
        };

        earnings.forEach(earning => {
            summary.total_gross += earning.gross_amount;
            summary.total_commission += earning.platform_commission;
            summary.total_net += earning.net_amount;

            if (earning.payout_status === 'pending') {
                summary.pending_earnings += earning.net_amount;
            } else if (earning.payout_status === 'paid') {
                summary.paid_earnings += earning.net_amount;
            }

            // Breakdown by type
            summary.breakdown_by_type[earning.type].count += 1;
            summary.breakdown_by_type[earning.type].amount += earning.net_amount;

            // Breakdown by station
            const stationId = earning.station_id?._id?.toString() || 'unknown';
            if (!summary.breakdown_by_station[stationId]) {
                summary.breakdown_by_station[stationId] = {
                    station_name: earning.station_id?.station_name || 'Unknown Station',
                    amount: 0,
                    count: 0
                };
            }
            summary.breakdown_by_station[stationId].amount += earning.net_amount;
            summary.breakdown_by_station[stationId].count += 1;
        });

        res.json({
            success: true,
            summary,
            earnings
        });
    } catch (error) {
        console.error('Error fetching current earnings:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get detailed earnings for a specific period
router.get('/earnings/detailed/:stationOwnerId', async (req, res) => {
    try {
        const { stationOwnerId } = req.params;
        const { month, year } = req.query;

        const stationOwner = await StationOwner.findById(stationOwnerId);
        if (!stationOwner) {
            return res.status(404).json({
                success: false,
                message: 'Access denied'
            });
        }

        const query = { station_owner_id: stationOwnerId };
        if (month && year) {
            query.month = parseInt(month);
            query.year = parseInt(year);
        }

        const earnings = await StationEarnings.find(query)
            .sort({ createdAt: -1 })
            .populate('station_id', 'station_name address')
            .populate('booking_id', 'booking_date start_time end_time')
            .populate('charging_session_id', 'start_time end_time energy_delivered total_cost price_per_kwh')
            .populate('payout_batch_id', 'batch_number status paid_at');

        res.json({
            success: true,
            earnings
        });
    } catch (error) {
        console.error('Error fetching detailed earnings:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get payout history
router.get('/payouts/:stationOwnerId', async (req, res) => {
    try {
        const { stationOwnerId } = req.params;

        // console.log('Fetching payout history for station owner:', stationOwnerId);
        const stationOwner = await StationOwner.findById(stationOwnerId);
        if (!stationOwner) {
            return res.status(404).json({
                success: false,
                message: 'Access denied'
            });
        }

        const payouts = await PayoutBatch.find({
            'payouts.station_owner_id': stationOwnerId,
            status: { $in: ['completed', 'approved'] }
        })
        .sort({ createdAt: -1 })
        .select('batch_number month year total_amount status createdAt payouts.$');

        const payoutHistory = payouts.map(batch => {
            const payout = batch.payouts.find(p => 
                p.station_owner_id.toString() === stationOwnerId
            );
            return {
                batch_number: batch.batch_number,
                month: batch.month,
                year: batch.year,
                amount: payout?.amount || 0,
                status: payout?.status || 'pending',
                paid_at: payout?.paid_at,
                bank_reference: payout?.bank_reference,
                payment_proof_url: payout?.payment_proof_url,
                batch_status: batch.status,
                created_at: batch.createdAt
            };
        });

        res.json({
            success: true,
            payouts: payoutHistory
        });
    } catch (error) {
        console.error('Error fetching payout history:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get station-specific transactions
router.get('/:stationOwnerId/:stationId/transactions', async (req, res) => {
    try {
        const { stationId, stationOwnerId } = req.params;
        const { page = 1, limit = 10, type, startDate, endDate } = req.query;
        
        // const stationOwnerId = req.user.id;

        // Verify the station belongs to the requesting station owner
        const stationEarnings = await StationEarnings.findOne({
            station_id: stationId,
            station_owner_id: stationOwnerId
        });

        // Build query for station earnings
        let earningsQuery = {
            station_id: stationId
        };

        // Filter by type if provided
        if (type && type !== 'all') {
            earningsQuery.type = type;
        }

        // Filter by date range if provided
        if (startDate || endDate) {
            earningsQuery.createdAt = {};
            if (startDate) earningsQuery.createdAt.$gte = new Date(startDate);
            if (endDate) earningsQuery.createdAt.$lte = new Date(endDate);
        }

        const earnings = await StationEarnings.find(earningsQuery)
            .sort({ createdAt: -1 })
            .populate('station_id', 'station_name')
            .populate('booking_id', 'booking_date start_time end_time')
            .populate('charging_session_id')
            .populate('payout_batch_id', 'batch_number status')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Get total count for pagination
        const totalCount = await StationEarnings.countDocuments(earningsQuery);

        // Transform data for frontend
        const transactions = earnings.map(earning => {
            let transactionType = '';
            let sessionId = '';
            let bookingId = '';
            let description = '';

            if (earning.type === 'booking_fee') {
                transactionType = 'Booking Fee';
                bookingId = earning.booking_id?._id?.toString().slice(-6) || 'N/A';
                description = `Booking #${bookingId}`;
            } else if (earning.type === 'charging_fee') {
                transactionType = 'Charging Session';
                sessionId = earning.charging_session_id?._id?.toString().slice(-6) || 'N/A';
                bookingId = earning.booking_id?._id?.toString().slice(-6) || 'N/A';
                description = `Charging Session #${sessionId}`;
            }

            return {
                Id: earning._id,
                transactionId: earning._id.toString().slice(-6).toUpperCase(),
                date: earning.createdAt,
                type: transactionType,
                description: description,
                sessionId: sessionId,
                bookingId: bookingId,
                grossAmount: earning.gross_amount,
                commission: earning.platform_commission,
                netAmount: earning.net_amount,
                payoutStatus: earning.payout_status,
                chargingSession: earning.charging_session_id,
                booking: earning.booking_id
            };
        });

        // Get summary statistics
        const summary = await StationEarnings.aggregate([
            {
                $match: {
                    station_id: new mongoose.Types.ObjectId(stationId)
                }
            },
            {
                $group: {
                    _id: null,
                    totalGross: { $sum: '$gross_amount' },
                    totalCommission: { $sum: '$platform_commission' },
                    totalNet: { $sum: '$net_amount' },
                    totalTransactions: { $sum: 1 },
                    pendingAmount: {
                        $sum: {
                            $cond: [{ $eq: ['$payout_status', 'pending'] }, '$net_amount', 0]
                        }
                    },
                    paidAmount: {
                        $sum: {
                            $cond: [{ $eq: ['$payout_status', 'paid'] }, '$net_amount', 0]
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            transactions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalTransactions: totalCount,
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            },
            summary: summary[0] || {
                totalGross: 0,
                totalCommission: 0,
                totalNet: 0,
                totalTransactions: 0,
                pendingAmount: 0,
                paidAmount: 0
            }
        });

    } catch (error) {
        console.error('Error fetching station transactions:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get transaction details for receipt
router.get('/transactions/:transactionId/details/:stationOwnerId', async (req, res) => {
    try {
        const { transactionId, stationOwnerId } = req.params;

        console.log('Fetching transaction details for:', transactionId);
        const earning = await StationEarnings.findById(transactionId)
            .populate('station_id', 'station_name address')
            .populate('booking_id')
            .populate('charging_session_id')
            .populate('station_owner_id', 'name businessName');

        if (!earning) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        Owner = await StationOwner.findById(stationOwnerId);
        if (!Owner) {
            return res.status(404).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            transaction: earning
        });

    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get transaction statistics for dashboard
router.get('/:stationOwnerId/:stationId/transactions/stats', async (req, res) => {
    try {
        const { stationId, stationOwnerId } = req.params;
        const { period = 'month' } = req.query; // month, week, year

        // Verify station ownership
        const stationEarnings = await StationEarnings.findOne({
            station_id: stationId,
            station_owner_id: stationOwnerId
        });

        Owner = await StationOwner.findById(stationOwnerId);
        if (!Owner) {
            return res.status(404).json({
                success: false,
                message: 'Access denied'
            });
        }

        let dateFilter = {};
        const now = new Date();

        if (period === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            dateFilter = { createdAt: { $gte: oneWeekAgo } };
        } else if (period === 'month') {
            const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            dateFilter = { createdAt: { $gte: oneMonthAgo } };
        } else if (period === 'year') {
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            dateFilter = { createdAt: { $gte: oneYearAgo } };
        }

        const stats = await StationEarnings.aggregate([
            {
                $match: {
                    station_id: new mongoose.Types.ObjectId(stationId),
                    ...dateFilter
                }
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$net_amount' },
                    averageAmount: { $avg: '$net_amount' }
                }
            }
        ]);

        // Get daily earnings for the last 7 days
        const dailyEarnings = await StationEarnings.aggregate([
            {
                $match: {
                    station_id: new mongoose.Types.ObjectId(stationId),
                    createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    amount: { $sum: '$net_amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            stats,
            dailyEarnings,
            period
        });

    } catch (error) {
        console.error('Error fetching transaction stats:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get transaction receipt details
router.get('/transactions/:transactionId/details/:userId/receipt', async (req, res) => {
    try {
        const { transactionId, userId } = req.params;

        const earning = await StationEarnings.findById(transactionId)
            .populate('station_id', 'station_name address city district')
            .populate('station_owner_id', 'name businessName email contact')
            .populate('booking_id')
            .populate('charging_session_id')
            .populate('payout_batch_id', 'batch_number');

        if (!earning) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Format receipt data
        const receiptData = {
            receiptNumber: `RCP-${earning._id.toString().slice(-8).toUpperCase()}`,
            transactionDate: earning.createdAt,
            stationName: earning.station_id?.station_name || 'N/A',
            stationAddress: `${earning.station_id?.address || ''}, ${earning.station_id?.city || ''}, ${earning.station_id?.district || ''}`,
            stationOwner: earning.station_owner_id?.businessName || earning.station_owner_id?.name || 'N/A',
            transactionType: earning.type === 'booking_fee' ? 'Booking Fee' : 'Charging Session Fee',
            grossAmount: earning.gross_amount,
            commissionRate: earning.commission_percentage || 10,
            commissionAmount: earning.platform_commission,
            netAmount: earning.net_amount,
            payoutStatus: earning.payout_status,
            payoutBatch: earning.payout_batch_id?.batch_number || 'N/A',
            bookingId: earning.booking_id?._id?.toString().slice(-6) || 'N/A',
            chargingSessionId: earning.charging_session_id?._id?.toString().slice(-6) || 'N/A',
            energyDelivered: earning.charging_session_id?.energy_delivered || 0,
            pricePerKwh: earning.charging_session_id?.price_per_kwh || 0
        };

        res.json({
            success: true,
            receipt: receiptData
        });

    } catch (error) {
        console.error('Error fetching receipt details:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;