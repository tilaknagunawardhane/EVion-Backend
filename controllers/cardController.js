const crypto = require('crypto');
require('dotenv').config();

// Step 1: Create Preapproval form params
exports.createPreapproval = (req, res) => {
  const { firstName, lastName, email, phone, address, city, country } = req.body;

  const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
  const MERCHANT_SECRET = process.env.PAYHERE_SECRET;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:19006'; // your app URL

  const order_id = `preapproval_${Date.now()}`;
  const items = 'Wallet Topup';
  const currency = 'LKR';
  const amount = '10.00';

  // Generate hash
  const hash = crypto.createHash('md5')
    .update(
      MERCHANT_ID +
      order_id +
      amount +
      currency +
      crypto.createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase()
    )
    .digest('hex').toUpperCase();

  res.json({
    preapprovalUrl: 'https://sandbox.payhere.lk/pay/preapprove',
    params: {
      merchant_id: MERCHANT_ID,
      return_url: `${FRONTEND_URL}/preapproval-success`,
      cancel_url: `${FRONTEND_URL}/preapproval-cancel`,
      notify_url: `${FRONTEND_URL}/api/cards/preapproval-notify`,
      order_id,
      items,
      currency,
      amount,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address,
      city,
      country,
      hash
    }
  });
};

// Step 2: Handle PayHere server callback
exports.preapprovalNotify = (req, res) => {
  const {
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
    customer_token
  } = req.body;

  const MERCHANT_SECRET = process.env.PAYHERE_SECRET;

  const local_md5sig = crypto.createHash('md5')
    .update(
      merchant_id +
      order_id +
      payhere_amount +
      payhere_currency +
      status_code +
      crypto.createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase()
    )
    .digest('hex').toUpperCase();

  if (local_md5sig === md5sig && status_code === '2') {
    console.log('Preapproval successful! Customer token:', customer_token);
    // TODO: save customer_token securely in DB linked to user
  } else {
    console.log('Preapproval failed or invalid signature');
  }

  res.send('OK'); // Required by PayHere
};
