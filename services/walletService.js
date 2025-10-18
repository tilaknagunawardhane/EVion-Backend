const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');
const StationEarnings = require('../models/stationEarningsModel');
const mongoose = require('mongoose');

class WalletService {
    // Create wallet for new EV owner
    async createWallet(evOwnerId) {
        const wallet = new Wallet({
            ev_owner_id: evOwnerId,
            balance: 0,
            status: 'active'
        });
        await wallet.save();
        return wallet;
    }

    // Get wallet balance
    async getBalance(evOwnerId) {
        const wallet = await Wallet.findOne({ ev_owner_id: evOwnerId });
        if (!wallet) throw new Error('Wallet not found');
        return wallet.balance;
    }

    // Top up wallet
    async topUp(evOwnerId, amount, paymentGatewayRef) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const wallet = await Wallet.findOne({ ev_owner_id: evOwnerId }).session(session);
            if (!wallet) throw new Error('Wallet not found');

            const balanceBefore = wallet.balance;
            wallet.balance += amount;
            await wallet.save({ session });

            const transaction = new Transaction({
                wallet_id: wallet._id,
                ev_owner_id: evOwnerId,
                type: 'topup',
                amount: amount,
                balance_before: balanceBefore,
                balance_after: wallet.balance,
                status: 'completed',
                payment_method: 'card',
                payment_gateway_ref: paymentGatewayRef,
                description: `Wallet top-up of LKR ${amount}`
            });
            await transaction.save({ session });

            await session.commitTransaction();
            return { wallet, transaction };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Deduct booking fee
    async chargeBookingFee(evOwnerId, bookingId, amount, stationId, stationOwnerId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const wallet = await Wallet.findOne({ ev_owner_id: evOwnerId }).session(session);
            if (!wallet) throw new Error('Wallet not found');
            if (wallet.balance < amount) throw new Error('Insufficient balance');

            const balanceBefore = wallet.balance;
            wallet.balance -= amount;
            await wallet.save({ session });

            const transaction = new Transaction({
                wallet_id: wallet._id,
                ev_owner_id: evOwnerId,
                type: 'booking_charge',
                amount: -amount,
                balance_before: balanceBefore,
                balance_after: wallet.balance,
                status: 'completed',
                booking_id: bookingId,
                payment_method: 'wallet',
                description: `Booking fee for booking #${bookingId}`
            });
            await transaction.save({ session });

            // Record station owner earnings
            const commissionPercentage = 10; // 10% platform commission
            const platformCommission = (amount * commissionPercentage) / 100;
            const netAmount = amount - platformCommission;

            const earnings = new StationEarnings({
                station_owner_id: stationOwnerId,
                station_id: stationId,
                booking_id: bookingId,
                type: 'booking_fee',
                gross_amount: amount,
                platform_commission: platformCommission,
                net_amount: netAmount,
                commission_percentage: commissionPercentage,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                payout_status: 'pending'
            });
            await earnings.save({ session });

            await session.commitTransaction();
            return { wallet, transaction };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Charge for charging session
    async chargeForCharging(evOwnerId, chargingSessionId, amount, stationId, stationOwnerId, bookingId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const wallet = await Wallet.findOne({ ev_owner_id: evOwnerId }).session(session);
            if (!wallet) throw new Error('Wallet not found');
            if (wallet.balance < amount) throw new Error('Insufficient balance');

            const balanceBefore = wallet.balance;
            wallet.balance -= amount;
            await wallet.save({ session });

            const transaction = new Transaction({
                wallet_id: wallet._id,
                ev_owner_id: evOwnerId,
                type: 'charging_charge',
                amount: -amount,
                balance_before: balanceBefore,
                balance_after: wallet.balance,
                status: 'completed',
                charging_session_id: chargingSessionId,
                booking_id: bookingId,
                payment_method: 'wallet',
                description: `Charging fee for session #${chargingSessionId}`
            });
            await transaction.save({ session });

            // Record station owner earnings
            const commissionPercentage = 10;
            const platformCommission = (amount * commissionPercentage) / 100;
            const netAmount = amount - platformCommission;

            const earnings = new StationEarnings({
                station_owner_id: stationOwnerId,
                station_id: stationId,
                charging_session_id: chargingSessionId,
                booking_id: bookingId,
                type: 'charging_fee',
                gross_amount: amount,
                platform_commission: platformCommission,
                net_amount: netAmount,
                commission_percentage: commissionPercentage,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                payout_status: 'pending'
            });
            await earnings.save({ session });

            await session.commitTransaction();
            return { wallet, transaction };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Refund booking fee (station closure or report)
    async refundBooking(evOwnerId, bookingId, amount, reason, reportId = null) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const wallet = await Wallet.findOne({ ev_owner_id: evOwnerId }).session(session);
            if (!wallet) throw new Error('Wallet not found');

            const balanceBefore = wallet.balance;
            wallet.balance += amount;
            await wallet.save({ session });

            const transaction = new Transaction({
                wallet_id: wallet._id,
                ev_owner_id: evOwnerId,
                type: 'refund_booking',
                amount: amount,
                balance_before: balanceBefore,
                balance_after: wallet.balance,
                status: 'completed',
                booking_id: bookingId,
                report_id: reportId,
                payment_method: 'wallet',
                description: `Refund for booking #${bookingId} - ${reason}`
            });
            await transaction.save({ session });

            // Update the corresponding earnings record to deduct from station owner
            await StationEarnings.updateOne(
                { booking_id: bookingId },
                {
                    payout_status: 'on_hold',
                    metadata: { refunded: true, reason: reason }
                }
            ).session(session);

            await session.commitTransaction();
            return { wallet, transaction };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Get transaction history
    async getTransactionHistory(evOwnerId, limit = 50, skip = 0) {
        const transactions = await Transaction.find({ ev_owner_id: evOwnerId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .populate('booking_id', 'booking_date start_time end_time')
            .populate('charging_session_id', 'start_time end_time energy_delivered');

        return transactions;
    }

    // Check if wallet has sufficient balance
    async hasSufficientBalance(evOwnerId, requiredAmount) {
        const wallet = await Wallet.findOne({ ev_owner_id: evOwnerId });
        if (!wallet) return false;
        return wallet.balance >= requiredAmount;
    }
}

module.exports = new WalletService();