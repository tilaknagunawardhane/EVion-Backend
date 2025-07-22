// models/districtModel.js
const mongoose = require('mongoose');

const districtSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  province: {
    type: String,
    required: true,
  },
  
}, {
    timestamps: true
});


const District = mongoose.model('district', districtSchema);
module.exports = District;