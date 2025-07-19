const { verifyToken } = require('../config/jwt');
const Admin = require('../models/adminModel');
const EvOwner = require('../models/evOwnerModel');
const StationOwner = require('../models/stationOwnerModel');

const authMiddleware = (allowedUserTypes = []) => async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized - No token provided' });
        }

        const decoded = await verifyToken(token);

        // Find user in all possible collections
        let user = await Admin.findById(decoded.id) ||
            await EvOwner.findById(decoded.id) ||
            await StationOwner.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Token is not valid - User not found' });
        }

        // Check if user type is allowed (if specific types were specified)
        if (allowedUserTypes.length > 0) {
            const userType = user.constructor.modelName.toLowerCase();
            const allowedTypesLower = allowedUserTypes.map(t => t.toLowerCase());
            if (!allowedTypesLower.includes(userType)) {
                return res.status(403).json({ success: false, message: 'Forbidden - Insufficient permissions' });
            }
        }

        req.user = user;
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error during authentication' });
    }
};

module.exports = authMiddleware;