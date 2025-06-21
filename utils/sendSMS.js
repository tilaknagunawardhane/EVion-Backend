const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

const sendSMS = async (to, message) => {
  try {
    const res = await client.messages.create({
      body: message,
      from: fromPhone,
      to, // Must be in E.164 format (e.g., +94771234567)
    });
    console.log('SMS sent:', res.sid);
    return res;
  } catch (error) {
    console.error('Twilio SMS error:', error.message);
    throw error;
  }
};

module.exports = sendSMS;
