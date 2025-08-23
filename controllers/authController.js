const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');
const Admin = require('../models/adminModel');
const EvOwner = require('../models/evOwnerModel');
const StationOwner = require('../models/stationOwnerModel');
const SupportOfficer = require('../models/supportOfficerModel');
const { imageUpload } = require('../utils/fileUpload');
const path = require('path');
const fs = require('fs');

exports.uploadImage = imageUpload({
    destination: 'uploads/stationOwners',
    fieldName: 'nicImage',
    maxFileSize: 10 * 1024 * 1024 // 10MB
});

const generateTokens = (user, userType) => {
    const accessToken = generateToken({
        id: user._id,
        email: user.email,
        userType,
        role: user.role,
    }, '5d'); // 15 minutes expiration

    const refreshToken = generateToken({
        id: user._id,
        userType,
    }, '7d'); // 7 days expiration

    return { accessToken, refreshToken };
};

//Common Login
const loginUser = async (Model, req, res) => {
    const { email, password } = req.body;
    console.log(req.body);

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
        if (Model.modelName === 'SupportOfficer') {
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
            user: userData,
            userType: Model.modelName.toLowerCase(),
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
        console.log('Hashed password: ', hashedPassword);

        user = await Model.create({
            name,
            email,
            password: hashedPassword,
        });

        const payload = {
            id: user._id,
            email: user.email,
            userType: Model.modelName.toLowerCase(),

        };

        if (Model.modelName === 'Admin') {
            payload.role = user.role;
        }

        // Generate tokens
        const accessToken = generateToken(payload, '5d');
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

const registerStationOwner = async (req, res) => {
    const {
        name,
        email,
        contact,
        password,
       businessName = null,  // Set default as null
        businessRegistrationNumber = null,
        taxId = null,
        district = null,
        accountHolderName,
        bank,
        branch,
        accountNumber,
        nic
    } = req.body;

    const nicImage = req.file; // Assuming you're using multer for file upload
    if (!nicImage) {
        return res.status(400).json({
            success: false,
            message: 'NIC image is required'
        });
    }
    console.log('rey.body: ', req.body);
    try {
        // Check if user already exists
        const existingUser = await StationOwner.findOne({ $or: [{ email: email }, { nic: nic }] });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or NIC already exists'
            });
        }

        // Validate business registration number uniqueness
        const existingBusiness = await StationOwner.findOne({ businessRegistrationNumber });
        if (existingBusiness) {
            return res.status(400).json({
                success: false,
                message: 'Business registration number already in use'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new station owner
        const stationOwner = await StationOwner.create({
            name,
            email,
            contact,
            password: hashedPassword,
            accountHolderName,
            bank,
            branch,
            accountNumber,
            nic,
            nicImage: nicImage ? `/uploads/stationOwners/${nicImage.filename}` : null, // Store file path if uploaded,
            // Only include business fields if they have values
            ...(businessName && { businessName }),
            ...(businessRegistrationNumber && { businessRegistrationNumber }),
            ...(taxId && { taxId }),
            ...(district && { district })
        });

        // Generate tokens
        const payload = {
            id: stationOwner._id,
            email: stationOwner.email,
            userType: 'stationowner',
        };

        const accessToken = generateToken(payload, '15m');
        const refreshToken = generateToken({ id: stationOwner._id }, '7d');

        // Set cookies (optional)
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

        // Prepare response data (exclude sensitive fields)
        const stationOwnerData = stationOwner.toObject();
        delete stationOwnerData.password;
        delete stationOwnerData.__v;

        // Send welcome email (optional)
        // await sendWelcomeEmail(stationOwner.email, stationOwner.name);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Account pending verification.',
            accessToken,
            refreshToken,
            user: stationOwnerData
        });

    } catch (error) {
        console.error('Station owner registration error:', error);

        // Clean up uploaded file if registration failed
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }

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
            case 'supportofficer':
                user = await SupportOfficer.findById(decoded.id);
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

exports.supportOfficerLogin = async (req, res) => {
    loginUser(SupportOfficer, req, res);
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
    registerStationOwner(req, res);
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
        safeUserData.userType = req.user.userType || req.user.constructor.modelName.toLowerCase();

        // Add any computed fields
        safeUserData.isVerified = !!safeUserData.verified;
        // console.log('safe: ', safeUserData);

        res.status(200).json({
            success: true,
            data: {
                user: safeUserData,
                // Include any additional metadata
                roles: safeUserData.userType || ['user'],
                // permissions: getPermissionsForUser(safeUserData)
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

