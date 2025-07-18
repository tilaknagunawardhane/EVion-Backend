const {verifyToken} = require('../config/jwt');
const Admin = require('../models/adminModel');
const EvOwner =require('../models/evOwnerModel');
const StationOwner = require('../models/stationOwnerModel');

const authMiddleware = (userType) => async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({message: 'Unauthorized'});
        }
        const decoded = await verifyToken(token);
        let user;
        switch (userType) {
            case 'admin':
                user = await Admin.findById(decoded.id);
                break;
            case 'evOwner':
                user = await EvOwner.findById(decoded.id);
                break;
            case 'stationOwner':
                user = await StationOwner.findById(decoded.id);
                break;
            default:
                return res.status(400).json({message: 'Invalid user type'});
        }
        if (!user) {
            return res.status(401).json({message: 'Token is not valid'});
        }

        req.user = user;
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({message: 'Internal server error'});
    }
};

module.exports = authMiddleware;