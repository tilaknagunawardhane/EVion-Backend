const StationEarnings = require('../models/stationEarningsModel');
const PayoutBatch = require('../models/payoutBatchModel');
const StationOwner = require('../models/stationOwnerModel');
const mongoose = require('mongoose');
const path = require('path');
const { createCustomUpload, FILE_TYPES } = require('../utils/fileUpload');

class PayoutService {

    uploadPaymentProof = createCustomUpload({
        destination: 'uploads/payouts',
        fieldName: 'payment-proofs',
        maxFileSize: 10 * 1024 * 1024,
        allowedTypes: [...FILE_TYPES.IMAGE, ...FILE_TYPES.DOCUMENT],
    });

    // Check if station owner already has payout for the month
    async checkExistingPayout(stationOwnerId, month, year) {
        try {
            const existingPayout = await PayoutBatch.findOne({
                month: month,
                year: year,
                'payouts.station_owner_id': stationOwnerId,
                status: { $in: ['draft', 'approved', 'completed'] }
            });

            return existingPayout;
        } catch (error) {
            throw error;
        }
    }

    // Generate monthly payout report with duplicate checks
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

            // Get station owner details with bank information and check for existing payouts
            const payoutSummary = [];

            for (const earning of earnings) {
                // Check if station owner already has a payout for this month
                const existingPayout = await this.checkExistingPayout(earning._id, month, year);
                
                if (existingPayout) {
                    console.log(`Skipping station owner ${earning._id} - already has payout in batch ${existingPayout.batch_number}`);
                    continue; // Skip this station owner
                }

                const stationOwner = await StationOwner.findById(earning._id)
                    .populate('bank', 'name');

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

    // Create payout batch with duplicate prevention
    async createPayoutBatch(month, year, adminId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // First, check if there's already a batch for this month/year in draft/approved status
            const existingBatch = await PayoutBatch.findOne({
                month: month,
                year: year,
                status: { $in: ['draft', 'approved'] }
            }).session(session);

            if (existingBatch) {
                throw new Error(`A payout batch for ${month}/${year} already exists (${existingBatch.batch_number}). Please complete or cancel it first.`);
            }

            const payoutSummary = await this.generateMonthlyPayoutReport(month, year);

            if (payoutSummary.length === 0) {
                throw new Error('No pending payouts for this period or all station owners already have payouts');
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

            await payoutBatch.save({ session });

            // Lock the earnings records by setting payout_batch_id
            for (const payout of payoutSummary) {
                await StationEarnings.updateMany(
                    {
                        _id: { $in: payout.earnings_ids }
                    },
                    {
                        payout_batch_id: payoutBatch._id,
                        payout_status: 'processing'
                    },
                    { session }
                );
            }

            await session.commitTransaction();

            return {
                batch: payoutBatch,
                details: payoutSummary,
                message: `Created payout batch with ${payoutSummary.length} station owners`
            };

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Enhanced approve payout batch with additional checks
    async approvePayoutBatch(batchId, adminId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const batch = await PayoutBatch.findById(batchId).session(session);

            if (!batch) {
                throw new Error('Batch not found');
            }

            if (batch.status !== 'draft') {
                throw new Error('Batch already processed');
            }

            // Double-check that no station owners in this batch have been paid in another batch
            for (const payout of batch.payouts) {
                const existingPayout = await this.checkExistingPayout(
                    payout.station_owner_id, 
                    batch.month, 
                    batch.year
                );

                if (existingPayout && existingPayout._id.toString() !== batchId) {
                    throw new Error(`Station owner ${payout.station_owner_id} already has a payout in batch ${existingPayout.batch_number}`);
                }
            }

            batch.status = 'approved';
            batch.approved_by = adminId;
            await batch.save({ session });

            await session.commitTransaction();
            return batch;

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Get all station owners with pending payouts for a period
    async getPendingPayoutStationOwners(month, year) {
        try {
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
                        transaction_count: { $sum: 1 }
                    }
                }
            ]);

            const result = [];

            for (const earning of earnings) {
                const stationOwner = await StationOwner.findById(earning._id)
                    .populate('bank', 'name');

                const existingPayout = await this.checkExistingPayout(earning._id, month, year);
                const hasExistingPayout = !!existingPayout;

                result.push({
                    station_owner_id: earning._id,
                    station_owner_name: stationOwner?.name || 'Unknown',
                    business_name: stationOwner?.businessName || 'N/A',
                    bank: stationOwner?.bank?.name || 'N/A',
                    total_amount: earning.total_amount,
                    transaction_count: earning.transaction_count,
                    has_existing_payout: hasExistingPayout,
                    existing_batch: hasExistingPayout ? existingPayout.batch_number : null,
                    existing_status: hasExistingPayout ? existingPayout.status : null
                });
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    // Cancel a payout batch and release earnings records
    async cancelPayoutBatch(batchId, adminId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const batch = await PayoutBatch.findById(batchId).session(session);

            if (!batch) {
                throw new Error('Batch not found');
            }

            if (batch.status === 'completed') {
                throw new Error('Cannot cancel a completed batch');
            }

            // Release all earnings records back to pending
            await StationEarnings.updateMany(
                {
                    payout_batch_id: batchId
                },
                {
                    payout_status: 'pending',
                    payout_batch_id: null
                },
                { session }
            );

            // Mark batch as cancelled
            batch.status = 'failed';
            batch.notes = `Cancelled by admin ${adminId} at ${new Date().toISOString()}`;
            await batch.save({ session });

            await session.commitTransaction();
            return batch;

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Upload payment proof and mark payout as paid (updated with additional checks)
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

            // Double-check no duplicate payout exists
            const existingPayout = await this.checkExistingPayout(stationOwnerId, batch.month, batch.year);
            if (existingPayout && existingPayout._id.toString() !== batchId) {
                throw new Error(`Station owner already has a payout in batch ${existingPayout.batch_number}`);
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

    // Process payment for entire batch (mark all payouts as paid) with duplicate checks
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
            
            // Check for duplicates before processing
            for (const payout of batch.payouts) {
                if (payout.status === 'pending') {
                    const existingPayout = await this.checkExistingPayout(
                        payout.station_owner_id, 
                        batch.month, 
                        batch.year
                    );
                    
                    if (existingPayout && existingPayout._id.toString() !== batchId) {
                        throw new Error(`Station owner ${payout.station_owner_id} already has a payout in batch ${existingPayout.batch_number}`);
                    }
                }
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

    // Get payout batches with filtering (no changes needed)
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

    // Get payout batch details (no changes needed)
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

    // Get payout statistics for admin dashboard (no changes needed)
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

    // Get payout history for station owner (no changes needed)
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

    // Get station owner dashboard stats (no changes needed)
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