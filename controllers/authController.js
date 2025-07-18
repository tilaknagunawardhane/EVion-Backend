const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');
const Admin = require('../models/adminModel');
const EvOwner = require('../models/evOwnerModel');
const StationOwner = require('../models/stationOwnerModel');

const generateTokens = (user, userType) => {
    const accessToken = generateToken({
        id: user._id,
        email: user.email,
        userType,
        role: user.role,
    }, '15m'); // 15 minutes expiration

    const refreshToken = generateToken({
        id: user._id,
        userType,
    }, '7d'); // 7 days expiration

    return { accessToken, refreshToken };
};

//Common Login
const loginUser = async (Model, req, res) => {
    const { email, password } = req.body;

    try {
        const user = await Model.findOne({ email }).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const payload = {
            id: user._id,
            email: user.email,
            userType: Model.modelName.toLowerCase()
        };

        if (Model.modelName === 'Admin') {
            payload.role = user.role;
        }

        // Generate both tokens
        const accessToken = generateToken(payload, '15m'); // 15 minutes expiration
        const refreshToken = generateToken({ id: user._id }, '7d'); // 7 days expiration

        // Return tokens in response (don't set cookie for mobile clients)
        const userData = user.toObject();
        delete userData.password;

        res.status(200).json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: userData
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const registerUser = async (Model, req, res) => {
    const { name, email, password } = req.body;
    console.log('req body is: ', req.body);

    try {
        let user = await Model.findOne({ email });
        if (user) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await Model.create({
            name,
            email,
            password: hashedPassword,
        });

        const payload = {
            id: user._id,
            email: user.email,
            userType: Model.modelName.toLowerCase()
        };

        if (Model.modelName === 'Admin') {
            payload.role = user.role;
        }

        // Generate tokens
        const accessToken = generateToken(payload, '15m');
        const refreshToken = generateToken({ id: user._id }, '7d');

        // Set cookies (optional for mobile clients)
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });
        
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        const userData = user.toObject();
        delete userData.password;

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            accessToken,
            refreshToken,
            user: userData
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// authController.js
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token required' });
        }

        const decoded = await verifyToken(refreshToken);

        let user;
        switch (decoded.userType) {
            case 'admin':
                user = await Admin.findById(decoded.id);
                break;
            case 'evowner':
                user = await EvOwner.findById(decoded.id);
                break;
            case 'stationowner':
                user = await StationOwner.findById(decoded.id);
                break;
            default:
                return res.status(400).json({ message: 'Invalid user type' });
        }

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user, decoded.userType);

        res.status(200).json({
            accessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({ message: 'Invalid refresh token' });
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
        // Verify user exists in request
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Convert Mongoose document to plain object if needed
        const userObj = req.user.toObject ? req.user.toObject() : req.user;

        // Sanitize user data
        const { password, __v, refreshToken, ...safeUserData } = userObj;

        // Add any computed fields
        safeUserData.isVerified = !!safeUserData.verified;

        res.status(200).json({
            success: true,
            data: {
                user: safeUserData,
                // Include any additional metadata
                roles: safeUserData.roles || ['user'],
                permissions: getPermissionsForUser(safeUserData)
            }
        });

    } catch (err) {
        console.error('GetMe error:', err);
        
        // Differentiate between server errors and validation errors
        const statusCode = err.name === 'ValidationError' ? 400 : 500;
        
        res.status(statusCode).json({
            success: false,
            message: 'Error fetching user data',
            error: process.env.NODE_ENV === 'development' ? {
                message: err.message,
                stack: err.stack
            } : undefined
        });
    }
};