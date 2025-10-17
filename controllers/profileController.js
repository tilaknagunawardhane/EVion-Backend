const asyncHandler = require('express-async-handler');
const EvOwner = require('../models/evOwnerModel');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Inline email sender using nodemailer (previously in utils/sendEmail.js)
const sendVerificationEmail = async ({ to, subject, text, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    // If we're in development, allow a fallback so frontend can be tested
    if (process.env.NODE_ENV === 'development') {
      console.warn('EMAIL_USER/EMAIL_PASS not set — logging verification email to console (dev fallback).');
      console.info('--- Verification email (dev fallback) ---');
      console.info('To:', to);
      console.info('Subject:', subject);
      console.info('Text:', text);
      console.info('HTML:', html);
      console.info('--- End verification email ---');
      return Promise.resolve({ devFallback: true });
    }

    throw new Error('Email credentials are not configured in environment variables');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const msg = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  };

  return transporter.sendMail(msg);
};

// Simple profile endpoints for EvOwner mirroring partneredChargingStation style
// GET /api/evowner/profile/:id  -> fetch profile
// PUT /api/evowner/profile/:id  -> update profile fields

const getProfile = asyncHandler(async (req, res) => {
  try {
  const { id } = req.params;
  const user = await EvOwner.findById(id).select('name email contact_number home_address apartment street_name city district recovery_phone');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('getProfile error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

const updateProfile = asyncHandler(async (req, res) => {
  try {
  const { id } = req.params;
  const { name,contact_number, home_address, apartment, street_name, city, district } = req.body;

    const user = await EvOwner.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined) user.name = name;
  
    if (contact_number !== undefined) user.contact_number = contact_number;
  if (home_address !== undefined) user.home_address = home_address;
  if (apartment !== undefined) user.apartment = apartment;
  if (street_name !== undefined) user.street_name = street_name;
  if (city !== undefined) user.city = city;
  if (district !== undefined) user.district = district;
  
   

    await user.save();

    return res.status(200).json({ success: true, message: 'Profile updated', data: {
      _id: user._id,
      name: user.name,
      email: user.email,
  contact_number: user.contact_number,
  home_address: user.home_address,
  apartment: user.apartment || '',
  street_name: user.street_name || '',
  city: user.city || '',
  district: user.district || '',
     
    }});
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// POST /api/evowners/profile/:id/email/send-otp
// body: { newEmail }
const sendEmailOtp = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ success: false, message: 'newEmail is required' });

    const user = await EvOwner.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.pending_email = newEmail;
    user.email_otp = otp;
    user.email_otp_time = new Date();
    await user.save();

    // send email with OTP to newEmail
    const subject = 'EVion - Verify your new email address';
    const text = `Your verification code is: ${otp}`;
    const html = `<p>Your verification code is: <strong>${otp}</strong></p>`;

    try {
      await sendVerificationEmail({ to: newEmail, subject, text, html });
    } catch (emailErr) {
      console.error('Error sending verification email:', emailErr.message || emailErr);
      return res.status(500).json({ success: false, message: 'Failed to send verification email' });
    }

    // Return the pending email so frontend can show where the OTP was sent.
    const responsePayload = { success: true, message: 'Verification email sent', email: newEmail };
    // In development, also return the OTP for easier testing (only when NODE_ENV=development)
    if (process.env.NODE_ENV === 'development') {
      responsePayload.dev_otp = otp;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('sendEmailOtp error:', error);
    return res.status(500).json({ success: false, message: 'Error sending email OTP' });
  }
});

// POST /api/evowners/profile/:id/email/verify
// body: { otp }
const verifyEmailOtp = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'otp is required' });

    const user = await EvOwner.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.email_otp || !user.pending_email) {
      return res.status(400).json({ success: false, message: 'No pending email change' });
    }

    const otpAgeSeconds = (new Date() - new Date(user.email_otp_time)) / 1000;
    if (otpAgeSeconds > 10 * 60) { // 10 minutes expiry
      user.pending_email = null;
      user.email_otp = null;
      user.email_otp_time = null;
      await user.save();
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    if (user.email_otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // All good - apply new email
    user.email = user.pending_email;
    user.pending_email = null;
    user.email_otp = null;
    user.email_otp_time = null;
    await user.save();

    // Return updated profile so frontend can immediately update Basic Info view
    return res.status(200).json({
      success: true,
      message: 'Email verified and updated',
      data: {
  _id: user._id,
  name: user.name,
  email: user.email,
  contact_number: user.contact_number,
  home_address: user.home_address,

      }
    });
  } catch (error) {
    console.error('verifyEmailOtp error:', error);
    return res.status(500).json({ success: false, message: 'Error verifying OTP' });
  }
});

  // POST /api/evowners/profile/:id/address
  // body: { apartment, street_name, city, district }
  const saveAddress = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { apartment, street_name, city, district } = req.body;

      const user = await EvOwner.findById(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      if (apartment !== undefined) user.apartment = apartment;
      if (street_name !== undefined) user.street_name = street_name;
      if (city !== undefined) user.city = city;
      if (district !== undefined) user.district = district;

      // Compose a formatted home_address for display
      const parts = [];
      if (user.apartment) parts.push(user.apartment);
      if (user.street_name) parts.push(user.street_name);
      if (user.city) parts.push(user.city);
      if (user.district) parts.push(user.district);
      user.home_address = parts.join(', ');

      await user.save();

      return res.status(200).json({ success: true, message: 'Address saved', data: {
        _id: user._id,
        email: user.email,
        name: user.name,
        contact_number: user.contact_number,
        home_address: user.home_address,
        apartment: user.apartment || '',
        street_name: user.street_name || '',
        city: user.city || '',
        district: user.district || ''
      }});
    } catch (error) {
      console.error('saveAddress error:', error);
      return res.status(500).json({ success: false, message: 'Error saving address' });
    }
  });

  // POST /api/evowners/profile/:id/change-password
  // body: { currentPassword, newPassword }
  const changePassword = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });

      const user = await EvOwner.findById(id).select('+password');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

      // validate password length
      if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      return res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('changePassword error:', error);
      return res.status(500).json({ success: false, message: 'Error changing password' });
    }
  });

  // POST /api/evowners/profile/:id/recovery-phone
  // body: { recovery_phone }
  const updateRecoveryPhone = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { recovery_phone } = req.body;
      if (!recovery_phone) return res.status(400).json({ success: false, message: 'recovery_phone is required' });

      const user = await EvOwner.findById(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      user.recovery_phone = recovery_phone;
      await user.save();

      return res.status(200).json({ success: true, message: 'Recovery phone updated', data: { recovery_phone: user.recovery_phone } });
    } catch (error) {
      console.error('updateRecoveryPhone error:', error);
      return res.status(500).json({ success: false, message: 'Error updating recovery phone' });
    }
  });

module.exports = {
  getProfile,
  updateProfile,
  sendEmailOtp,
  verifyEmailOtp,
  saveAddress
  ,changePassword,
  updateRecoveryPhone
};
