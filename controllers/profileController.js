
const asyncHandler = require('express-async-handler');
const Profile = require('../models/profileModel');
const path = require('path');

// Get profile info
const getProfile = asyncHandler(async (req, res) => {
  try {
    const profile = await Profile.findById(req.user.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update profile info
const updateProfile = asyncHandler(async (req, res) => {
  try {
    const updates = req.body;
    const profile = await Profile.findByIdAndUpdate(req.user.id, updates, { new: true });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update address
const updateAddress = asyncHandler(async (req, res) => {
  try {
    const { suit, street, city, district } = req.body;
    const profile = await Profile.findByIdAndUpdate(
      req.user.id,
      { address: { suit, street, city, district } },
      { new: true }
    );
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Address update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = {
  getProfile,
  updateProfile,
  updateAddress
};
