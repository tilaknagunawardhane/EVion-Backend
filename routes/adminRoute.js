const express = require('express');
const PayoutService = require('../services/payoutService');
const router = express.Router();
const {
    getAdminRequests,
    getRequestDetails,
    updateRequestStatus
} = require('../controllers/adminController');
const { adminLogin } = require('../controllers/authController');

router.get('/get-requests', getAdminRequests);
router.get('/request-details/:id', getRequestDetails);
router.put('/update-request-status/:id', updateRequestStatus);

// Payout routes

// Get payout dashboard stats
router.get('/admin/payouts/dashboard', async (req, res) => {
    try {
        const stats = await PayoutService.getPayoutDashboardStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Generate monthly payout report
router.get('/admin/payouts/report/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        const report = await PayoutService.generateMonthlyPayoutReport(
            parseInt(month), 
            parseInt(year)
        );
        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create payout batch
router.post('/admin/payouts/batch/create/:adminId', async (req, res) => {
    try {
        const { month, year } = req.body;
        const { id } = req.params;
        const result = await PayoutService.createPayoutBatch(
            parseInt(month), 
            parseInt(year),
            admidId
        );
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Approve payout batch
router.post('/admin/payouts/batch/:batch_id/approve/:adminId', async (req, res) => {
    try {
        const batch = await PayoutService.approvePayoutBatch(
            req.params.batch_id,
            adminId
        );
        res.json({ success: true, batch });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mark payout as paid
router.post('/admin/payouts/batch/:batch_id/mark-paid', async (req, res) => {
    try {
        const { station_owner_id, bank_reference } = req.body;
        const payout = await PayoutService.markPayoutAsPaid(
            req.params.batch_id,
            station_owner_id,
            bank_reference
        );
        res.json({ success: true, payout });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all payout batches
router.get('/admin/payouts/batches', async (req, res) => {
    try {
        const batches = await PayoutBatch.find()
            .sort({ createdAt: -1 })
            .populate('created_by', 'name email')
            .populate('approved_by', 'name email')
            .limit(50);
        res.json({ success: true, batches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;