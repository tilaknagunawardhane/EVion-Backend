const crypto = require('crypto');
const WalletService = require('../services/walletService');

// PayHere Configuration (get from PayHere dashboard)
const PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
const PAYHERE_SANDBOX = process.env.NODE_ENV !== 'production';

class PaymentController {
    
    // Initiate top-up
    async initiateTopUp(req, res) {
        try {
            const { amount } = req.body; // Amount to top up
            const evOwnerId = req.user._id;
            const user = req.user;
            
            if (amount < 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Minimum top-up amount is LKR 100'
                });
            }
            
            // Generate unique order ID
            const orderId = `TOPUP_${Date.now()}_${evOwnerId}`;
            
            // PayHere payment data
            const paymentData = {
                merchant_id: PAYHERE_MERCHANT_ID,
                return_url: `${process.env.APP_URL}/payment/success`,
                cancel_url: `${process.env.APP_URL}/payment/cancel`,
                notify_url: `${process.env.API_URL}/api/payment/notify`,
                order_id: orderId,
                items: 'Wallet Top-Up',
                currency: 'LKR',
                amount: amount.toFixed(2),
                first_name: user.name.split(' ')[0],
                last_name: user.name.split(' ').slice(1).join(' ') || 'User',
                email: user.email,
                phone: user.contact_number || '0771234567',
                address: user.home_address || 'Sri Lanka',
                city: 'Colombo',
                country: 'Sri Lanka',
                custom_1: evOwnerId.toString(), // Store user ID for callback
                custom_2: 'topup'
            };
            
            // Generate hash
            const hash = this.generatePayHereHash(paymentData);
            paymentData.hash = hash;
            
            res.json({
                success: true,
                payment_data: paymentData,
                sandbox: PAYHERE_SANDBOX
            });
            
        } catch (error) {
            console.error('Payment initiation error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
    
    // PayHere notification handler (webhook)
    async handlePayHereNotify(req, res) {
        try {
            const {
                merchant_id,
                order_id,
                payment_id,
                payhere_amount,
                payhere_currency,
                status_code,
                md5sig,
                custom_1, // ev_owner_id
                custom_2  // 'topup'
            } = req.body;
            
            // Verify hash
            const localMd5sig = this.generateMd5Hash(
                merchant_id,
                order_id,
                payhere_amount,
                payhere_currency,
                status_code
            );
            
            if (localMd5sig !== md5sig) {
                console.error('Invalid payment hash');
                return res.status(400).send('Invalid hash');
            }
            
            // Check if payment is successful
            if (status_code === '2') {
                const evOwnerId = custom_1;
                const amount = parseFloat(payhere_amount);
                
                // Top up wallet
                await WalletService.topUp(evOwnerId, amount, payment_id);
                
                console.log(`Wallet topped up: ${evOwnerId} - LKR ${amount}`);
                
                // Send notification to user
                // ... notification code
            }
            
            res.status(200).send('OK');
            
        } catch (error) {
            console.error('Payment notification error:', error);
            res.status(500).send('Error');
        }
    }
    
    // Generate PayHere hash
    generatePayHereHash(data) {
        const hashString = 
            PAYHERE_MERCHANT_ID + 
            data.order_id + 
            data.amount + 
            data.currency +
            this.getMd5Hash(PAYHERE_MERCHANT_SECRET);
        
        return this.getMd5Hash(hashString).toUpperCase();
    }
    
    // Generate MD5 hash for verification
    generateMd5Hash(merchant_id, order_id, amount, currency, status_code) {
        const hashString = 
            merchant_id + 
            order_id + 
            amount + 
            currency + 
            status_code +
            this.getMd5Hash(PAYHERE_MERCHANT_SECRET);
        
        return this.getMd5Hash(hashString).toUpperCase();
    }
    
    getMd5Hash(string) {
        return crypto.createHash('md5').update(string).digest('hex');
    }
}

module.exports = new PaymentController();