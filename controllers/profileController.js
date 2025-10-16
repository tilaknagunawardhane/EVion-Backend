const asyncHandler = require('express-async-handler');
const EvOwner = require('../models/evOwnerModel');

// Simple profile endpoints for EvOwner mirroring partneredChargingStation style
// GET /api/evowner/profile/:id  -> fetch profile
// PUT /api/evowner/profile/:id  -> update profile fields

const getProfile = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const user = await EvOwner.findById(id).select('name email contact_number home_address ');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('getProfile error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

const updateProfile = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name,contact_number, home_address } = req.body;

    const user = await EvOwner.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined) user.name = name;
  
    if (contact_number !== undefined) user.contact_number = contact_number;
    if (home_address !== undefined) user.home_address = home_address;
   

    await user.save();

    return res.status(200).json({ success: true, message: 'Profile updated', data: {
      _id: user._id,
      name: user.name,
      
      contact_number: user.contact_number,
      home_address: user.home_address,
     
    }});
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

module.exports = {
  getProfile,
  updateProfile
};
