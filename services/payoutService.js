const StationEarnings = require('../models/StationEarnings');
const PayoutBatch = require('../models/PayoutBatch');
const StationOwner = require('../models/StationOwner');

class PayoutService {
    
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
            
            // Get station owner details
            const payoutSummary = [];
            
            for (const earning of earnings) {
                const stationOwner = await StationOwner.findById(earning._id)
                    .populate('bank');
                
                if (stationOwner) {
                    payoutSummary.push({
                        station_owner_id: earning._id,
                        station_owner_name: stationOwner.name,
                        bank: stationOwner.bank.name,
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
    
    // Mark individual payout as paid
    async markPayoutAsPaid(batchId, stationOwnerId, bankReference) {
        try {
            const batch = await PayoutBatch.findById(batchId);
            
            if (!batch) {
                throw new Error('Batch not found');
            }
            
            // Update payout status in batch
            const payout = batch.payouts.find(
                p => p.station_owner_id.toString() === stationOwnerId.toString()
            );
            
            if (!payout) {
                throw new Error('Payout not found in batch');
            }
            
            payout.status = 'paid';
            payout.bank_reference = bankReference;
            payout.paid_at = new Date();
            
            await batch.save();
            
            // Update earnings records
            await StationEarnings.updateMany(
                {
                    station_owner_id: stationOwnerId,
                    payout_batch_id: batchId,
                    payout_status: 'processing'
                },
                {
                    payout_status: 'paid',
                    paid_at: new Date()
                }
            );
            
            // Check if all payouts in batch are complete
            const allPaid = batch.payouts.every(p => p.status === 'paid');
            if (allPaid) {
                batch.status = 'completed';
                await batch.save();
            }
            
            return payout;
            
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
    
    // Get dashboard stats for admin
    async getPayoutDashboardStats() {
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            
            // Current month pending payouts
            const pendingStats = await StationEarnings.aggregate([
                {
                    $match: {
                        month: currentMonth,
                        year: currentYear,
                        payout_status: 'pending'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total_amount: { $sum: '$net_amount' },
                        platform_commission: { $sum: '$platform_commission' },
                        total_transactions: { $sum: 1 }
                    }
                }
            ]);
            
            // Total paid out this year
            const yearlyPaid = await StationEarnings.aggregate([
                {
                    $match: {
                        year: currentYear,
                        payout_status: 'paid'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total_paid: { $sum: '$net_amount' }
                    }
                }
            ]);
            
            return {
                pending: pendingStats[0] || { total_amount: 0, platform_commission: 0, total_transactions: 0 },
                yearly_paid: yearlyPaid[0]?.total_paid || 0,
                current_month: currentMonth,
                current_year: currentYear
            };
            
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new PayoutService();