const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middlewares/authMiddleware');

// Get profile
router.get('/:userType/:id', authMiddleware, profileController.getProfile);
// Update profile
router.put('/:userType/:id', authMiddleware, profileController.updateProfile);
// Delete account
router.delete('/:userType/:id', authMiddleware, profileController.deleteAccount);
// Change password
router.post('/:userType/:id/change-password', authMiddleware, profileController.changePassword);

module.exports = router;
