const Wallet = require('../models/walletModel');
const Transaction = require('../models/transactionModel');
const StationEarnings = require('../models/stationEarningsModel');
const mongoose = require('mongoose');
const Booking = require('../models/bookingModel');

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
    async refundBooking(evOwnerId, bookingId, amount, reason, reportId = null, stationOwnerId) {
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

            // Update the corresponding earnings record to on_hold or mark as refunded
            await StationEarnings.findOneAndUpdate(
                { booking_id: bookingId },
                {
                    payout_status: 'on_hold',
                    metadata: {
                        refunded: true,
                        reason: reason,
                        refund_amount: amount,
                        refunded_at: new Date(),
                        refunded_by: stationOwnerId
                    }
                },
                { session }
            );

            // Update booking payment status
            await Booking.findOneAndUpdate(
                { _id: bookingId },
                {
                    status: 'cancelled',
                    cancellation_reason: reason,
                    cancelled_by_type: 'StationOwner',
                    cancelled_by_id: evOwnerId
                },
                { session }
            );

            await session.commitTransaction();
            return { wallet, transaction };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Check if a booking was refunded
    async wasBookingRefunded(bookingId) {
        const earning = await StationEarnings.findOne({
            booking_id: bookingId,
            'metadata.refunded': true
        });

        return {
            wasRefunded: !!earning,
            refundAmount: earning?.metadata?.refund_amount || 0,
            refundReason: earning?.metadata?.reason || '',
            refundedAt: earning?.metadata?.refunded_at || null
        };
    }

    // Get all refunds for a station owner
    async getStationRefunds(stationOwnerId, startDate, endDate) {
        const refunds = await StationEarnings.find({
            station_owner_id: stationOwnerId,
            'metadata.refunded': true,
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        })
            .populate('booking_id')
            .populate('station_id', 'station_name')
            .sort({ createdAt: -1 });

        return refunds;
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

    // Refund booking fee (partial refund for user cancellations)
    // Refund booking fee with retry logic for transaction conflicts
    async refundBooking(evOwnerId, bookingId, amount, reason, reportId = null, stationOwnerId) {
        const MAX_RETRIES = 3;
        let retryCount = 0;

        while (retryCount < MAX_RETRIES) {
            const session = await mongoose.startSession();

            try {
                session.startTransaction();

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

                // Update station earnings with atomic operation
                await StationEarnings.findOneAndUpdate(
                    { booking_id: bookingId },
                    {
                        $set: {
                            payout_status: 'on_hold',
                            'metadata.refunded': true,
                            'metadata.reason': reason,
                            'metadata.refund_amount': amount,
                            'metadata.refunded_at': new Date(),
                            'metadata.refunded_by': stationOwnerId
                        }
                    },
                    { session }
                );

                await session.commitTransaction();
                console.log(`Refund transaction completed successfully for booking ${bookingId}`);
                return { wallet, transaction };

            } catch (error) {
                await session.abortTransaction();

                if (error.message.includes('WriteConflict') && retryCount < MAX_RETRIES - 1) {
                    retryCount++;
                    console.log(`Write conflict detected, retrying... (${retryCount}/${MAX_RETRIES})`);
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
                    continue;
                }

                console.error(`Refund failed after ${retryCount + 1} attempts:`, error);
                throw error;
            } finally {
                session.endSession();
            }
        }
    }
}

module.exports = new WalletService();