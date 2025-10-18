const express = require('express');
const router = express.Router();
const StationEarnings = require('../models/stationEarningsModel');
const PayoutBatch = require('../models/payoutBatchModel');
const StationOwner = require('../models/stationOwnerModel');

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

module.exports = router;