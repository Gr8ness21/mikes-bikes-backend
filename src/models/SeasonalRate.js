const mongoose = require('mongoose');

const seasonalRateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    multiplier: { type: Number, required: true, min: 0.1 },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SeasonalRate', seasonalRateSchema);
