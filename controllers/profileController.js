// Profile management controller
const Admin = require('../models/adminModel');
const EvOwner = require('../models/evOwnerModel');
const StationOwner = require('../models/stationOwnerModel');
const bcrypt = require('bcryptjs');

function getModel(userType) {
  switch (userType) {
    case 'admin': return Admin;
    case 'evowner': return EvOwner;
    case 'stationowner': return StationOwner;
    default: return null;
  }
}

module.exports = {
  // Get profile by user type and ID
  async getProfile(req, res) {
    const { userType, id } = req.params;
    const Model = getModel(userType);
    if (!Model) return res.status(400).json({ success: false, message: 'Invalid user type' });
    try {
      const user = await Model.findById(id).select('-password');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  // Update profile
  async updateProfile(req, res) {
    const { userType, id } = req.params;
    const Model = getModel(userType);
    if (!Model) return res.status(400).json({ success: false, message: 'Invalid user type' });
    try {
      // Prevent password update here
      const updateData = { ...req.body };
      delete updateData.password;
      const user = await Model.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select('-password');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
  },

  // Delete account
  async deleteAccount(req, res) {
    const { userType, id } = req.params;
    const Model = getModel(userType);
    if (!Model) return res.status(400).json({ success: false, message: 'Invalid user type' });
    try {
      const user = await Model.findByIdAndDelete(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  // Change password
  async changePassword(req, res) {
    const { userType, id } = req.params;
    const { oldPassword, newPassword } = req.body;
    const Model = getModel(userType);
    if (!Model) return res.status(400).json({ success: false, message: 'Invalid user type' });
    try {
      const user = await Model.findById(id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      // Check old password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) return res.status(400).json({ success: false, message: 'Old password is incorrect' });
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
};
