// models/branchModel.js
const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: true
  },
  district: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'district',
    required: true
  },
  address: String,
  contact: String
}, {
  timestamps: true
});

// Compound index to prevent duplicate branches for same bank in same district
branchSchema.index({ name: 1, bank: 1, district: 1 }, { unique: true });

module.exports = mongoose.model('Branch', branchSchema);