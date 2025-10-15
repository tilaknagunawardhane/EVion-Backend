const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  suit: { type: String },
  street: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true }
});

const profileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  contactNumber: { type: String, required: true },
  address: { type: addressSchema },
  workPlace: { type: String }
});

module.exports = mongoose.model('Profile', profileSchema);
