const EvOwner = require('../models/evOwnerModel');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const sendSMS = require('../utils/sendSMS');

const registerEvOwner = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    console.log(req.body);

    // Check if all fields are provided
    if (!name || !email || !password) {
        // res.status(400);
        // throw new Error('Please fill in all fields');
        return res.status(400).json({ message: 'Please fill in all fields' });

    }

    // Check if user already exists
    const existingUser = await EvOwner.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });

    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new EV owner
    const evOwner = await EvOwner.create({
        name,
        email,
        password: hashedPassword,

    });

    if (evOwner) {
        res.status(201).json({
            user: {
                _id: evOwner._id,
                name: evOwner.name,
                email: evOwner.email,
            }
        });
    } else {
        // res.status(400);
        // throw new Error('Invalid user data');
        return res.status(400).json({ message: 'Invalid user data' });

    }
});

const loginEvOwner = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Check if all fields are provided
    if (!email || !password) {
        // res.status(400);
        // throw new Error('Please fill in all fields');
        return res.status(400).json({ message: 'Please fill in all fields' });

    }

    // Find user by email
    const evOwner = await EvOwner.findOne({ email });
    if (evOwner && (await bcrypt.compare(password, evOwner.password))) {
        res.json({
            _id: evOwner._id,
            name: evOwner.name,
            email: evOwner.email,
            contact_number: evOwner.contact_number,
            home_address: evOwner.home_address
        });
    } else {
        console.log('Invalid Credentials');
        res.status(400).json({ message: 'Invalid credentials' });
    }
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTP = asyncHandler(async (req, res) => {
    const { email, mobile } = req.body;

    try {
        const user = await EvOwner.findOne({ email });

        if (!user) {
            res.status(400).json({ message: 'User not found' });
        }

        const otp = generateOTP();
        const otpTime = new Date();

        console.log('OTP is ' + otp);

        user.otp = {
            mobile,
            otp,
            time: otpTime,
        };

        await user.save();

        // const internationalPhone = '+94' + mobile.slice(1); // Convert 0771234567 -> +94771234567
        // console.log(internationalPhone);
        // const message = `Your OTP is: ${otp}`;
        // await sendSMS(internationalPhone, message);

        console.log(`Sending OTP ${otp} to ${mobile}`);
        return res.status(200).json({ message: 'OTP sent successfully' });

        
    }
    catch (error) {

        console.error('Error in sendOTP:', error);
        return res.status(500).json({ error: error.message });
    }
});

const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await EvOwner.findOne({ email });
        if (!user || !user.otp) {
            return res.status(404).json({ error: 'No OTP found for this user' });
        }

        const currentTime = new Date();
        const otpAge = (currentTime - new Date(user.otp.time)) / 1000;

        if (otpAge > 300) { // 5 minutes
            return res.status(400).json({ error: 'OTP expired' });
        }

        if (user.otp.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // Clear OTP after successful verification
        user.otp = undefined;
        await user.save();

        res.json({ message: 'OTP verified successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
})

const resetPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  const user = await EvOwner.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  
  // Hash the new password
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);

  await user.save();

  return res.status(200).json({ message: 'Password updated successfully' });
});


module.exports = {
    registerEvOwner,
    loginEvOwner,
    sendOTP,
    verifyOTP,
    resetPassword
};
