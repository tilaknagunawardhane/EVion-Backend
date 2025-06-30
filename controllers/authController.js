const bcrypt = require('bcrypt');
const { generateToken } = require('../config/jwt');
const Admin = require('../models/adminModel');
const EvOwner = require('../models/evOwnerModel');
const StationOwner = require('../models/stationOwnerModel');

//Common Login
const loginUser = async (Model, req, res) => {
    const { email, password } = req.body;

    try {
        const user = await Model.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = {
            id: user._id,
            email: user.email,
            userType: Model.modelName.toLowerCase()
        };
        console.log('User payload:', payload);

        if (Model.modelName === 'Admin') {
            payload.role = user.role; // Include role for Admin
        }
        const token = generateToken(payload);
        console.log('Generated token:', token);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1 * 60 * 60 * 1000
        });

        const userData = user.toObject();
        delete userData.password; // Remove password from response

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: userData
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const registerUser = async (Model, req, res) => {
    const { email, password, ...rest } = req.body;

    try {
        let user = await Model.find({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await Model.create({
            email,
            password: hashedPassword,
            ...rest
        });

        const payload = {
            id: user._id,
            email: user.email,
            userType: Model.modelName.toLowerCase()
        };

        if (Model.modelName === 'Admin') {
            payload.role = user.role;
        }

        const token = generateToken(payload);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1 * 60 * 60 * 1000
        });

        const userData = user.toObject();
        delete userData.password; // Remove password from response

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: userData
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.adminLogin = async (req, res) => {
    loginUser(Admin, req, res);
};

exports.adminRegister = async (req, res) => {
    registerUser(Admin, req, res);
};

exports.evOwnerLogin = async (req, res) => {
    loginUser(EvOwner, req, res);
};

exports.evOwnerRegister = async (req, res) => {
    registerUser(EvOwner, req, res);
};

exports.stationOwnerLogin = async (req, res) => {
    loginUser(StationOwner, req, res);
};

exports.stationOwnerRegister = async (req, res) => {
    registerUser(StationOwner, req, res);
};

exports.logout = (req, res) => {
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
};

//Get current user
exports.getMe = async (req, res) => {
     try {
    const user = req.user.toObject();
    delete user.password;
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};  
