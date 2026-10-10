const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    year: { type: Number, required: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    operable: { type: Boolean, default: true },
    type: { type: String, default: 'motorcycle' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vehicle', vehicleSchema);
