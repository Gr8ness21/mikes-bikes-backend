const mongoose = require('mongoose');

const rateConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    brackets: [
      {
        maxMiles: { type: Number, required: true },
        perMile: { type: Number, required: true },
      },
    ],
    enclosedMultiplier: { type: Number, default: 1.5 },
    inoperableDiscountPct: { type: Number, default: 4.04 },
    i285FlatRate: { type: Number, default: 60 },
    minimumOpen: { type: Number, default: 150 },
    minimumEnclosed: { type: Number, default: 225 },
    dailyScheduledCapacity: { type: Number, default: 1 },
  },
  { timestamps: true }
);

rateConfigSchema.statics.defaults = function defaults() {
  return {
    key: 'default',
    brackets: [
      { maxMiles: 500, perMile: 1.75 },
      { maxMiles: 1000, perMile: 1.25 },
      { maxMiles: 1500, perMile: 1.0 },
      { maxMiles: 2000, perMile: 0.85 },
      { maxMiles: 2500, perMile: 0.75 },
      { maxMiles: 100000, perMile: 0.65 },
    ],
    enclosedMultiplier: 1.5,
    inoperableDiscountPct: 4.04,
    i285FlatRate: 60,
    minimumOpen: 150,
    minimumEnclosed: 225,
    dailyScheduledCapacity: 1,
  };
};

module.exports = mongoose.model('RateConfig', rateConfigSchema);
