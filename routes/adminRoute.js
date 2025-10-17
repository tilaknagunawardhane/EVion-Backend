const express = require('express');
const PayoutService = require('../services/payoutService');
const router = express.Router();
const PayoutBatch = require('../models/payoutBatchModel');
const {
    getAdminRequests,
    getRequestDetails,
    updateRequestStatus
} = require('../controllers/adminController');
const { adminLogin } = require('../controllers/authController');
const path = require('path');

router.get('/get-requests', getAdminRequests);
router.get('/request-details/:id', getRequestDetails);
router.put('/update-request-status/:id', updateRequestStatus);

// Payout routes
const uploadPaymentProof = (req, res, next) => {
  PayoutService.uploadPaymentProof(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
    next(); // ✅ continue to your route handler
  });
};

router.post('/upload/file', uploadPaymentProof, async (req, res) => {
  try {
    if (!req.file) {
      console.error('No file uploaded in request');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = path.join('/uploads/payouts', req.file.filename);
    console.log('Uploaded file URL:', fileUrl);

    res.json({ success: true, fileUrl });
    console.log('File uploaded successfully:', req.file.filename);

  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get payout dashboard stats
router.get('/payouts/dashboard', async (req, res) => {
    try {
        const stats = await PayoutService.getPayoutDashboardStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Generate monthly payout report
router.get('/payouts/report/:year/:month', async (req, res) => {
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
router.post('/payouts/batch/create/:adminId', async (req, res) => {
    try {
        const { month, year } = req.body;
        const { adminId } = req.params;
        console.log('Creating payout batch for:', { month, year, adminId });
        const result = await PayoutService.createPayoutBatch(
            parseInt(month), 
            parseInt(year),
            adminId
        );
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Approve payout batch
router.post('/payouts/batch/:batch_id/approve/:adminId', async (req, res) => {
    try {
        const batch = await PayoutService.approvePayoutBatch(
            req.params.batch_id,
            req.params.adminId
        );
        res.json({ success: true, batch });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mark payout as paid
router.post('/payouts/batch/:batch_id/mark-paid', async (req, res) => {
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
// router.get('/admin/payouts/batches', async (req, res) => {
//     try {
//         const batches = await PayoutBatch.find()
//             .sort({ createdAt: -1 })
//             .populate('created_by', 'name email')
//             .populate('approved_by', 'name email')
//             .limit(50);
//         res.json({ success: true, batches });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// });

// Get all payout batches with filters
router.get('/payouts/batches', async (req, res) => {
    try {
        const { status, month, year, search } = req.query;
        console.log('Filters:', { status, month, year, search });
        
        const batches = await PayoutService.getPayoutBatches({
            status,
            month,
            year,
            search
        });
        
        res.json({ success: true, batches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get payout batch details
router.get('/payouts/batches/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const details = await PayoutService.getPayoutBatchDetails(batchId);
        res.json({ success: true, ...details });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Upload payment proof and mark as paid
router.post('/payouts/batches/:batchId/pay', async (req, res) => {
    try {
        const { batchId } = req.params;
        const { station_owner_id, bank_reference, payment_proof_url, notes } = req.body;
        
        console.log('Processing payment for batch:', { batchId, station_owner_id });
        // If station_owner_id is provided, process single payout
        // Otherwise, process entire batch
        let result;
        if (station_owner_id) {
            result = await PayoutService.uploadPaymentProof(batchId, station_owner_id, {
                bank_reference,
                payment_proof_url,
                notes
            });
        } else {
            result = await PayoutService.processBatchPayment(batchId, {
                bank_reference,
                payment_proof_url,
                notes
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Payment processed successfully',
            ...result 
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get payout dashboard stats
router.get('/payouts/stats', async (req, res) => {
    try {
        const stats = await PayoutService.getAdminPayoutStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


module.exports = router;