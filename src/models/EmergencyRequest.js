const mongoose = require('mongoose');

const emergencyRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    pickupAddress: { type: String, required: true },
    dropoffAddress: { type: String, default: '' },
    year: { type: String, default: '' },
    make: { type: String, default: '' },
    model: { type: String, default: '' },
    operable: { type: Boolean, default: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmergencyRequest', emergencyRequestSchema);
