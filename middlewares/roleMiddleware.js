const roleMiddleware = (requiredRole) => (req, res, next) => {
    
    if (req.user.role !== requiredRole) {
    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  }
  next();

};

module.exports = roleMiddleware;