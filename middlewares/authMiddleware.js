// middlewares/authMiddleware.js
const { verifyToken } = require('../config/jwt');
const Admin = require('../models/adminModel');
const EvOwner = require('../models/evOwnerModel');
const StationOwner = require('../models/stationOwnerModel');

const authMiddleware = (allowedRoles = [], allowedUserTypes = []) => async (req, res, next) => {
  try {
    // console.log('come to middleware');
    // Token extraction from cookies, headers, or body
    const token = req.cookies.accessToken || 
                  req.headers.authorization?.split(' ')[1] || 
                  req.body.token;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const decoded = await verifyToken(token);
    // console.log('decoded: ', decoded)

    // Find user based on userType
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
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid user type' 
        });
    }

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check user type permissions
    if (allowedUserTypes.length > 0 && !allowedUserTypes.includes(decoded.userType)) {
      console.log('inside the allowedUserTypes');
      return res.status(403).json({ 
        success: false, 
        message: 'Access forbidden for this user type' 
      });
    }

    if(decoded.userType == 'evowner')
    {
        decoded.role = 'evowner';
    }
    // Check role permissions
    if (allowedRoles.length > 0 && (!decoded.role || !allowedRoles.includes(decoded.role))) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

module.exports = authMiddleware;