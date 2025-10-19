const express = require('express');
const router = express.Router();
const WalletService = require('../services/walletService');
const PaymentController = require('../controllers/paymentController');

// Get wallet balance
router.get('/balance/:userId', 
    PaymentController.getBalance.bind(PaymentController)
);

// Get transaction history
router.get('/transactions/:userId', 
    PaymentController.getTransactions.bind(PaymentController)
);

// Local wallet top-up (no authentication)
router.post('/topup/local/:userId', 
    PaymentController.localTopUp.bind(PaymentController)
);

// Check balance
router.post('/balance/check/:userId', 
    PaymentController.checkBalance.bind(PaymentController)
);

// // Charge for booking
// router.post('/charge/booking/:userId', async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { bookingId, amount, stationId, stationOwnerId } = req.body;

//         const result = await WalletService.chargeBookingFee(
//             userId, 
//             bookingId, 
//             amount, 
//             stationId, 
//             stationOwnerId
//         );

//         res.json({
//             success: true,
//             message: 'Booking fee charged successfully',
//             transaction: result.transaction
//         });
//     } catch (error) {
//         res.status(500).json({ 
//             success: false, 
//             message: error.message 
//         });
//     }
// });

// // Charge for charging session
// router.post('/charge/charging/:userId', async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { chargingSessionId, amount, stationId, stationOwnerId, bookingId } = req.body;

//         const result = await WalletService.chargeForCharging(
//             userId,
//             chargingSessionId,
//             amount,
//             stationId,
//             stationOwnerId,
//             bookingId
//         );

//         res.json({
//             success: true,
//             message: 'Charging fee processed successfully',
//             transaction: result.transaction
//         });
//     } catch (error) {
//         res.status(500).json({ 
//             success: false, 
//             message: error.message 
//         });
//     }
// });

// // Refund booking
// router.post('/refund/booking/:userId', async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { bookingId, amount, reason, reportId, stationOwnerId } = req.body;

//         const result = await WalletService.refundBooking(
//             userId,
//             bookingId,
//             amount,
//             reason,
//             reportId,
//             stationOwnerId
//         );

//         res.json({
//             success: true,
//             message: 'Refund processed successfully',
//             transaction: result.transaction
//         });
//     } catch (error) {
//         res.status(500).json({ 
//             success: false, 
//             message: error.message 
//         });
//     }
// });

module.exports = router;