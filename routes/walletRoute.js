const express = require('express');
const router = express.Router();
const WalletService = require('../services/walletService');
const PaymentController = require('../controllers/paymentController');

router.get('/balance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // console.log('Fetching wallet balance for user:', userId);
        const balance = await WalletService.getBalance(userId);
        res.json({ success: true, balance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get transaction history
router.get('/transactions/:userId', async (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.query;
        const { userId } = req.params;

        // console.log('Fetching transactions for user:', userId, 'limit:', limit, 'skip:', skip);
        const transactions = await WalletService.getTransactionHistory(
            userId,
            parseInt(limit),
            parseInt(skip)
        );
        res.json({ success: true, transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Initiate wallet top-up
router.post('/topup/initiate/:userId', 
    PaymentController.initiateTopUp.bind(PaymentController)
);

// PayHere notification webhook (no auth - comes from PayHere)
router.post('/payment/notify', 
    PaymentController.handlePayHereNotify.bind(PaymentController)
);

// Card management routes (NEW)
router.get('/cards/:userId', PaymentController.getSavedCards);
router.post('/cards/save', PaymentController.saveCardToken);
router.put('/cards/:cardId/default/:userId', PaymentController.setDefaultCard);
router.delete('/cards/:cardId/:userId', PaymentController.deleteCard);
router.post('/charge/saved-card', PaymentController.chargeWithSavedCard);

module.exports = router;