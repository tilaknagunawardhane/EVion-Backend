const express = require('express');
const router = express.Router();
const WalletService = require('../services/walletService');
const PaymentController = require('../controllers/paymentController');

// Get wallet balance
router.get('/balance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
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
router.post('/notify', 
    PaymentController.handlePayHereNotify.bind(PaymentController)
);

// Card management routes
router.get('/cards/:userId', 
    PaymentController.getSavedCards.bind(PaymentController)
);

router.post('/cards/save', 
    PaymentController.saveCardToken.bind(PaymentController)
);

router.put('/cards/:cardId/default/:userId', 
    PaymentController.setDefaultCard.bind(PaymentController)
);

router.delete('/cards/:cardId/:userId', 
    PaymentController.deleteCard.bind(PaymentController)
);

router.post('/charge/saved-card', 
    PaymentController.chargeWithSavedCard.bind(PaymentController)
);

module.exports = router;