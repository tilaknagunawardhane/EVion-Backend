const StationEarnings = require('../models/stationEarningsModel');
const PayoutBatch = require('../models/payoutBatchModel');
const StationOwner = require('../models/stationOwnerModel');
const mongoose = require('mongoose');
const path = require('path');
// const {imageUpload} = require('../utils/fileUpload');
const { createCustomUpload, FILE_TYPES } = require('../utils/fileUpload');

class PayoutService {

    uploadPaymentProof = createCustomUpload({
    destination: 'uploads/payouts',
    fieldName: 'payment-proofs',
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: [...FILE_TYPES.IMAGE, ...FILE_TYPES.DOCUMENT], // ✅ allow PDF too
  });

    // Generate monthly payout report
    async generateMonthlyPayoutReport(month, year) {
        try {
            // Get all pending earnings for the month
            const earnings = await StationEarnings.aggregate([
                {
                    $match: {
                        month: month,
                        year: year,
                        payout_status: 'pending'
                    }
                },
                {
                    $group: {
                        _id: '$station_owner_id',
                        total_amount: { $sum: '$net_amount' },
                        total_transactions: { $sum: 1 },
                        earnings_ids: { $push: '$_id' }
                    }
                }
            ]);

            // Get station owner details with bank information
            const payoutSummary = [];

            for (const earning of earnings) {
                const stationOwner = await StationOwner.findById(earning._id)
                    .populate('bank', 'name'); // Populate bank name

                if (stationOwner) {
                    payoutSummary.push({
                        station_owner_id: earning._id,
                        station_owner_name: stationOwner.name,
                        business_name: stationOwner.businessName,
                        bank: stationOwner.bank?.name || 'N/A',
                        branch: stationOwner.branch,
                        account_number: stationOwner.accountNumber,
                        account_holder: stationOwner.accountHolderName,
                        amount: earning.total_amount,
                        transactions: earning.total_transactions,
                        earnings_ids: earning.earnings_ids
                    });
                }
            }

            return payoutSummary;

        } catch (error) {
            throw error;
        }
    }

    // Create payout batch
    async createPayoutBatch(month, year, adminId) {
        try {
            const payoutSummary = await this.generateMonthlyPayoutReport(month, year);

            if (payoutSummary.length === 0) {
                throw new Error('No pending payouts for this period');
            }

            const totalAmount = payoutSummary.reduce((sum, p) => sum + p.amount, 0);
            const batchNumber = `PAYOUT_${year}${String(month).padStart(2, '0')}_${Date.now()}`;

            const payoutBatch = new PayoutBatch({
                batch_number: batchNumber,
                month: month,
                year: year,
                total_amount: totalAmount,
                total_station_owners: payoutSummary.length,
                status: 'draft',
                created_by: adminId,
                payouts: payoutSummary.map(p => ({
                    station_owner_id: p.station_owner_id,
                    amount: p.amount,
                    status: 'pending'
                }))
            });

            await payoutBatch.save();

            return {
                batch: payoutBatch,
                details: payoutSummary
            };

        } catch (error) {
            throw error;
        }
    }

    // Approve and process payout batch
    async approvePayoutBatch(batchId, adminId) {
        try {
            const batch = await PayoutBatch.findById(batchId);

            if (!batch) {
                throw new Error('Batch not found');
            }

            if (batch.status !== 'draft') {
                throw new Error('Batch already processed');
            }

            batch.status = 'approved';
            batch.approved_by = adminId;
            await batch.save();

            // Update all earnings records to 'processing'
            await StationEarnings.updateMany(
                {
                    month: batch.month,
                    year: batch.year,
                    payout_status: 'pending'
                },
                {
                    payout_status: 'processing',
                    payout_batch_id: batch._id
                }
            );

            return batch;

        } catch (error) {
            throw error;
        }
    }

    // Upload payment proof and mark payout as paid
    // Upload payment proof and mark payout as paid
    async uploadPaymentProof(batchId, stationOwnerId, proofData) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            const batch = await PayoutBatch.findById(batchId).session(session);
            
            if (!batch) {
                throw new Error('Batch not found');
            }
            
            if (batch.status !== 'approved') {
                throw new Error('Batch must be approved before marking payments as paid');
            }
            
            // Find the specific payout
            const payout = batch.payouts.find(
                p => p.station_owner_id.toString() === stationOwnerId.toString()
            );
            
            if (!payout) {
                throw new Error('Payout not found in batch');
            }
            
            if (payout.status === 'paid') {
                throw new Error('Payout already marked as paid');
            }
            
            // Update payout with proof
            payout.status = 'paid';
            payout.bank_reference = proofData.bank_reference;
            payout.payment_proof_url = proofData.payment_proof_url;
            payout.paid_at = new Date();
            payout.payment_notes = proofData.notes;
            
            await batch.save({ session });
            
            // Update earnings records
            await StationEarnings.updateMany(
                {
                    station_owner_id: stationOwnerId,
                    payout_batch_id: batchId,
                    payout_status: 'processing'
                },
                {
                    payout_status: 'paid',
                    paid_at: new Date(),
                    payment_proof_url: proofData.payment_proof_url
                },
                { session }
            );
            
            // Check if all payouts in batch are complete
            const allPaid = batch.payouts.every(p => p.status === 'paid');
            if (allPaid) {
                batch.status = 'completed';
                batch.completed_at = new Date();
                await batch.save({ session });
            }
            
            await session.commitTransaction();
            
            return {
                payout,
                batch_status: batch.status,
                all_payouts_completed: allPaid
            };
            
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Process payment for entire batch (mark all payouts as paid)
    async processBatchPayment(batchId, proofData) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            const batch = await PayoutBatch.findById(batchId).session(session);
            
            if (!batch) {
                throw new Error('Batch not found');
            }
            
            if (batch.status !== 'approved') {
                throw new Error('Batch must be approved before processing payments');
            }
            
            // Update all payouts in the batch
            const updatePromises = batch.payouts.map(async (payout) => {
                if (payout.status === 'pending') {
                    payout.status = 'paid';
                    payout.bank_reference = proofData.bank_reference;
                    payout.payment_proof_url = proofData.payment_proof_url;
                    payout.paid_at = new Date();
                    payout.payment_notes = proofData.notes;
                    
                    // Update corresponding earnings records
                    await StationEarnings.updateMany(
                        {
                            station_owner_id: payout.station_owner_id,
                            payout_batch_id: batchId,
                            payout_status: 'processing'
                        },
                        {
                            payout_status: 'paid',
                            paid_at: new Date(),
                            payment_proof_url: proofData.payment_proof_url
                        },
                        { session }
                    );
                }
            });
            
            await Promise.all(updatePromises);
            
            // Mark batch as completed
            batch.status = 'completed';
            batch.completed_at = new Date();
            await batch.save({ session });
            
            await session.commitTransaction();
            
            return {
                batch,
                processed_payouts: batch.payouts.length,
                total_amount: batch.total_amount
            };
            
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Get payout batches with filtering
    async getPayoutBatches(filters = {}) {
        try {
            const { status, month, year, search } = filters;

            let query = {};

            if (status && status !== 'all') {
                query.status = status;
            }

            if (month && year) {
                query.month = parseInt(month);
                query.year = parseInt(year);
            }

            if (search) {
                query.$or = [
                    { batch_number: { $regex: search, $options: 'i' } }
                ];
            }

            const batches = await PayoutBatch.find(query)
                .sort({ createdAt: -1 })
                .populate('created_by', 'email')
                .populate('approved_by', 'email')
                .populate('payouts.station_owner_id', 'name businessName email contact branch accountNumber accountHolderName');

            return batches;

        } catch (error) {
            throw error;
        }
    }

    // Get payout batch details
    async getPayoutBatchDetails(batchId) {
        try {
            const batch = await PayoutBatch.findById(batchId)
                .populate('created_by', 'email')
                .populate('approved_by', 'email')
                .populate({
                    path: 'payouts.station_owner_id',
                    select: 'name businessName email contact branch accountNumber accountHolderName bank',
                    populate: {
                        path: 'bank',
                        select: 'name code'
                    }
                });

            if (!batch) {
                throw new Error('Payout batch not found');
            }

            // Get detailed earnings for this batch
            const earnings = await StationEarnings.find({
                payout_batch_id: batchId
            }).populate('station_id', 'station_name')
                .populate('booking_id', 'booking_date')
                .populate('charging_session_id', 'start_time end_time energy_delivered');

            return {
                batch,
                earnings
            };

        } catch (error) {
            throw error;
        }
    }

    // Get payout statistics for admin dashboard
    async getAdminPayoutStats() {
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();

            // Monthly payout statistics
            const monthlyStats = await PayoutBatch.aggregate([
                {
                    $match: {
                        year: currentYear,
                        month: currentMonth
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        total_batches: { $sum: 1 },
                        total_amount: { $sum: '$total_amount' }
                    }
                }
            ]);

            // Yearly summary
            const yearlyStats = await PayoutBatch.aggregate([
                {
                    $match: {
                        year: currentYear
                    }
                },
                {
                    $group: {
                        _id: null,
                        total_paid: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$status', 'completed'] },
                                    '$total_amount',
                                    0
                                ]
                            }
                        },
                        total_pending: {
                            $sum: {
                                $cond: [
                                    { $in: ['$status', ['draft', 'approved']] },
                                    '$total_amount',
                                    0
                                ]
                            }
                        },
                        total_batches: { $sum: 1 }
                    }
                }
            ]);

            // Station owners awaiting payment
            const pendingOwners = await StationEarnings.aggregate([
                {
                    $match: {
                        year: currentYear,
                        month: currentMonth,
                        payout_status: 'pending'
                    }
                },
                {
                    $group: {
                        _id: '$station_owner_id',
                        total_amount: { $sum: '$net_amount' }
                    }
                }
            ]);

            return {
                monthly: monthlyStats,
                yearly: yearlyStats[0] || { total_paid: 0, total_pending: 0, total_batches: 0 },
                pending_station_owners: pendingOwners.length,
                current_month: currentMonth,
                current_year: currentYear
            };

        } catch (error) {
            throw error;
        }
    }

    // Get payout history for station owner
    async getStationOwnerPayoutHistory(stationOwnerId) {
        try {
            const earnings = await StationEarnings.find({
                station_owner_id: stationOwnerId
            })
                .sort({ year: -1, month: -1 })
                .populate('station_id', 'station_name')
                .populate('booking_id', 'booking_date')
                .populate('payout_batch_id');

            // Group by month/year
            const groupedEarnings = earnings.reduce((acc, earning) => {
                const key = `${earning.year}-${String(earning.month).padStart(2, '0')}`;
                if (!acc[key]) {
                    acc[key] = {
                        month: earning.month,
                        year: earning.year,
                        total_amount: 0,
                        status: earning.payout_status,
                        earnings: []
                    };
                }
                acc[key].total_amount += earning.net_amount;
                acc[key].earnings.push(earning);
                return acc;
            }, {});

            return Object.values(groupedEarnings);

        } catch (error) {
            throw error;
        }
    }

    // Get station owner dashboard stats
async getStationOwnerDashboardStats(stationOwnerId) {
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Current month earnings
        const currentMonthEarnings = await StationEarnings.aggregate([
            {
                $match: {
                    station_owner_id: new mongoose.Types.ObjectId(stationOwnerId),
                    month: currentMonth,
                    year: currentYear
                }
            },
            {
                $group: {
                    _id: null,
                    total_gross: { $sum: '$gross_amount' },
                    total_net: { $sum: '$net_amount' },
                    total_commission: { $sum: '$platform_commission' },
                    pending_earnings: {
                        $sum: {
                            $cond: [{ $eq: ['$payout_status', 'pending'] }, '$net_amount', 0]
                        }
                    },
                    earnings_count: { $sum: 1 }
                }
            }
        ]);

        // Last 6 months trend
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyTrend = await StationEarnings.aggregate([
            {
                $match: {
                    station_owner_id: new mongoose.Types.ObjectId(stationOwnerId),
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: { year: '$year', month: '$month' },
                    total_earnings: { $sum: '$net_amount' },
                    earnings_count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 }
        ]);

        // Recent payouts
        const recentPayouts = await PayoutBatch.find({
            'payouts.station_owner_id': stationOwnerId,
            status: 'completed'
        })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('batch_number month year total_amount payouts.$');

        const stats = {
            current_month: currentMonthEarnings[0] || {
                total_gross: 0,
                total_net: 0,
                total_commission: 0,
                pending_earnings: 0,
                earnings_count: 0
            },
            monthly_trend: monthlyTrend,
            recent_payouts: recentPayouts.map(batch => {
                const payout = batch.payouts.find(p => 
                    p.station_owner_id.toString() === stationOwnerId
                );
                return {
                    batch_number: batch.batch_number,
                    month: batch.month,
                    year: batch.year,
                    amount: payout?.amount || 0
                };
            })
        };

        return stats;
    } catch (error) {
        throw error;
    }
}
}

module.exports = new PayoutService();