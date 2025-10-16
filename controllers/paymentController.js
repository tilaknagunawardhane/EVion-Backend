const crypto = require('crypto');
const WalletService = require('../services/walletService');
const CardToken = require('../models/cardTokenModel');
const EvOwner = require('../models/evOwnerModel');

// PayHere Configuration
const PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
const PAYHERE_SANDBOX = process.env.NODE_ENV !== 'production';

class PaymentController {
    
    // Initiate top-up
    async initiateTopUp(req, res) {
        try {
            const { userId } = req.params;
            console.log('userId', userId);
            const { amount, save_card = false } = req.body; // Add save_card option
            // const evOwnerId = req.user._id;
            // const user = req.user;
            const user = await EvOwner.findById(userId);
            console.log('user', user);
            
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            if (amount < 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Minimum top-up amount is LKR 100'
                });
            }
            
            // Generate unique order ID
            const orderId = `TOPUP_${Date.now()}_${userId}`;
            
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
                first_name: user?.name?.split(' ')[0] || 'User',
                last_name: user?.name?.split(' ').slice(1).join(' ') || 'User',
                email: user.email,
                phone: user.contact_number || '0771234567',
                address: user.home_address || 'Sri Lanka',
                city: 'Colombo',
                country: 'Sri Lanka',
                custom_1: userId.toString(),
                custom_2: 'topup',
                custom_3: save_card ? 'save_card' : 'no_save' // Indicate if we should save card
            };

            console.log('Payment Data:', paymentData);
            // If save_card is true, enable recurring
            if (save_card) {
                paymentData.recurrence = '1 Month';
                paymentData.duration = 'Forever';
            }
            
            // Generate hash
            const hash = this.generatePayHereHash(paymentData);
            paymentData.hash = hash;
            
            res.json({
                success: true,
                payment_data: paymentData,
                sandbox: PAYHERE_SANDBOX,
                save_card_enabled: save_card
            });
            
        } catch (error) {
            console.error('Payment initiation error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Save card token
    async saveCardToken(req, res) {
        try {
            const { token_id, card_mask, card_type, card_holder_name, expiry_month, expiry_year } = req.body;
            const evOwnerId = req.user._id;

            // Validate required fields
            if (!token_id || !card_mask || !card_type) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required card information'
                });
            }

            // Check if token already exists and is active
            const existingCard = await CardToken.findOne({
                ev_owner_id: evOwnerId,
                token_id: token_id,
                status: 'active'
            });

            if (existingCard) {
                // Update last used timestamp
                await existingCard.updateLastUsed();
                
                return res.status(200).json({
                    success: true,
                    message: 'Card already exists',
                    card: existingCard
                });
            }

            // Check if there's a soft-deleted card with same token
            const deletedCard = await CardToken.findOne({
                ev_owner_id: evOwnerId,
                token_id: token_id,
                status: 'deleted'
            });

            let savedCard;

            if (deletedCard) {
                // Reactivate the deleted card
                deletedCard.status = 'active';
                deletedCard.last_used = new Date();
                deletedCard.card_mask = card_mask;
                deletedCard.card_type = card_type;
                if (card_holder_name) deletedCard.card_holder_name = card_holder_name;
                if (expiry_month) deletedCard.expiry_month = expiry_month;
                if (expiry_year) deletedCard.expiry_year = expiry_year;
                
                savedCard = await deletedCard.save();
            } else {
                // Check if this is the first card to set as default
                const activeCardCount = await CardToken.countDocuments({
                    ev_owner_id: evOwnerId,
                    status: 'active'
                });

                const isDefault = activeCardCount === 0;

                // Create new card token
                savedCard = await CardToken.create({
                    ev_owner_id: evOwnerId,
                    token_id: token_id,
                    card_mask: card_mask,
                    card_type: card_type,
                    card_holder_name: card_holder_name || '',
                    expiry_month: expiry_month || '',
                    expiry_year: expiry_year || '',
                    is_default: isDefault,
                    status: 'active',
                    last_used: new Date()
                });
            }

            res.status(201).json({
                success: true,
                message: 'Card saved successfully',
                card: savedCard
            });

        } catch (error) {
            console.error('Save card error:', error);
            
            // Handle duplicate key error
            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'Card already exists'
                });
            }
            
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get user's saved cards
    async getSavedCards(req, res) {
        try {
        const { userId } = req.params;

            // const evOwnerId = req.user._id;
            
            const cards = await CardToken.getActiveCards(userId);

            res.json({
                success: true,
                cards: cards,
                count: cards.length
            });

        } catch (error) {
            console.error('Get cards error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Set default card
    async setDefaultCard(req, res) {
        try {
            const { cardId, userId } = req.params;

            // Find and validate the card
            const card = await CardToken.findOne({
                _id: cardId,
                ev_owner_id: userId,
                status: 'active'
            });

            if (!card) {
                return res.status(404).json({
                    success: false,
                    message: 'Card not found or inactive'
                });
            }

            // This will trigger the pre-save middleware to update other cards
            card.is_default = true;
            card.last_used = new Date();
            await card.save();

            res.json({
                success: true,
                message: 'Default card updated successfully',
                card: card
            });

        } catch (error) {
            console.error('Set default card error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Delete saved card
    async deleteCard(req, res) {
        try {
            const { cardId, userId } = req.params;

            const card = await CardToken.findOne({
                _id: cardId,
                ev_owner_id: userId
            });

            if (!card) {
                return res.status(404).json({
                    success: false,
                    message: 'Card not found'
                });
            }

            // Soft delete the card
            await card.softDelete();

            // If we deleted the default card, set a new default
            if (card.is_default) {
                const newDefaultCard = await CardToken.findOne({
                    ev_owner_id: evOwnerId,
                    status: 'active'
                });

                if (newDefaultCard) {
                    newDefaultCard.is_default = true;
                    await newDefaultCard.save();
                }
            }

            res.json({
                success: true,
                message: 'Card deleted successfully'
            });

        } catch (error) {
            console.error('Delete card error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get default card
    async getDefaultCard(req, res) {
        try {
            const evOwnerId = req.user._id;

            const defaultCard = await CardToken.getDefaultCard(evOwnerId);

            if (!defaultCard) {
                return res.status(404).json({
                    success: false,
                    message: 'No default card found'
                });
            }

            res.json({
                success: true,
                card: defaultCard
            });

        } catch (error) {
            console.error('Get default card error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Charge using a saved card (placeholder / minimal implementation)
    async chargeWithSavedCard(req, res) {
        try {
            const evOwnerId = req.user && req.user._id;
            const { card_id, amount, description } = req.body;

            if (!evOwnerId) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            if (!card_id || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                return res.status(400).json({ success: false, message: 'card_id and valid amount are required' });
            }

            // NOTE: Full implementation should call payment gateway with saved token and handle responses.
            // For now return 501 Not Implemented to avoid runtime errors while wiring the route.
            return res.status(501).json({
                success: false,
                message: 'Charging with saved card is not implemented yet'
            });

        } catch (error) {
            console.error('chargeWithSavedCard error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // PayHere notification handler - UPDATED for card token saving
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
                custom_2,  // 'topup'
                custom_3,  // 'save_card' or 'no_save'
                customer_token, // Card token for saving
                card_holder_name,
                card_no, // Masked card number
                card_expiry,
                method // Payment method
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
                const shouldSaveCard = custom_3 === 'save_card';
                
                // Top up wallet
                await WalletService.topUp(evOwnerId, amount, payment_id);
                
                console.log(`Wallet topped up: ${evOwnerId} - LKR ${amount}`);
                
                // Save card token if available and requested
                if (shouldSaveCard && customer_token && method) {
                    try {
                        const cardType = this.mapPayHereMethodToCardType(method);
                        const cardMask = card_no || `******${payment_id.slice(-4)}`;
                        
                        await CardToken.findOneAndUpdate(
                            {
                                ev_owner_id: evOwnerId,
                                token_id: customer_token
                            },
                            {
                                ev_owner_id: evOwnerId,
                                token_id: customer_token,
                                card_mask: cardMask,
                                card_type: cardType,
                                card_holder_name: card_holder_name || '',
                                status: 'active',
                                last_used: new Date()
                            },
                            {
                                upsert: true,
                                new: true
                            }
                        );
                        
                        console.log(`Card token saved for user: ${evOwnerId}`);
                    } catch (cardError) {
                        console.error('Error saving card token from webhook:', cardError);
                        // Don't fail the payment if card saving fails
                    }
                }
            }
            
            res.status(200).send('OK');
            
        } catch (error) {
            console.error('Payment notification error:', error);
            res.status(500).send('Error');
        }
    }

    // Helper method to map PayHere method to card type
    mapPayHereMethodToCardType(method) {
        const methodMap = {
            'VISA': 'VISA',
            'MASTER': 'MASTER',
            'AMEX': 'AMEX',
            'MASTERCARD': 'MASTER'
        };
        
        return methodMap[method] || 'OTHER';
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