const RateConfig = require('../models/RateConfig');
const SeasonalRate = require('../models/SeasonalRate');

function perMileFor(miles, brackets) {
  const sorted = [...brackets].sort((a, b) => a.maxMiles - b.maxMiles);
  const match = sorted.find((b) => miles <= b.maxMiles) || sorted[sorted.length - 1];
  return match.perMile;
}

async function seasonalMultiplierFor(date) {
  const when = date ? new Date(date) : new Date();
  const rates = await SeasonalRate.find({
    startDate: { $lte: when },
    endDate: { $gte: when },
  }).sort({ multiplier: -1 });
  if (!rates.length) return { multiplier: 1, name: null };
  return { multiplier: rates[0].multiplier, name: rates[0].name };
}

async function getRateConfig() {
  let config = await RateConfig.findOne({ key: 'default' });
  if (!config) {
    config = await RateConfig.create(RateConfig.defaults());
  }
  return config;
}

async function calculateQuote({
  miles,
  transportType = 'open',
  operable = true,
  insideI285 = false,
  forDate,
}) {
  const config = await getRateConfig();
  const { multiplier: seasonalMultiplier, name: seasonalName } =
    await seasonalMultiplierFor(forDate);

  const notes = [];
  let i285Applied = false;

  if (insideI285) {
    i285Applied = true;
    notes.push(
      `Atlanta I-285 promo: $${config.i285FlatRate} flat rate because both pickup and drop-off are inside the perimeter.`
    );
    let total = config.i285FlatRate * seasonalMultiplier;
    if (seasonalName) {
      notes.push(`Seasonal / holiday rate "${seasonalName}" × ${seasonalMultiplier}.`);
    }
    let discount404 = 0;
    if (!operable) {
      discount404 = Math.round(total * (config.inoperableDiscountPct / 100) * 100) / 100;
      total = Math.round((total - discount404) * 100) / 100;
      notes.push(
        `404 discount: ${config.inoperableDiscountPct}% off because the motorcycle is inoperable.`
      );
    }
    const depositDue = Math.round(total * 50) / 100;
    return {
      currency: 'usd',
      subtotal: config.i285FlatRate,
      enclosedPremium: 0,
      seasonalMultiplier,
      discount404,
      i285Applied,
      total,
      depositDue,
      breakdown: {
        miles,
        perMile: 0,
        base: config.i285FlatRate,
        seasonalName,
        notes,
      },
    };
  }

  const perMile = perMileFor(miles, config.brackets);
  let base = miles * perMile;
  let enclosedPremium = 0;
  if (transportType === 'enclosed') {
    enclosedPremium = base * (config.enclosedMultiplier - 1);
  }
  let subtotal = base + enclosedPremium;
  subtotal *= seasonalMultiplier;
  if (seasonalName) {
    notes.push(`Seasonal / holiday rate "${seasonalName}" × ${seasonalMultiplier}.`);
  }

  const minimum = transportType === 'enclosed' ? config.minimumEnclosed : config.minimumOpen;
  if (subtotal < minimum) {
    notes.push(`Minimum ${transportType} rate of $${minimum.toFixed(2)} applied.`);
    subtotal = minimum;
  }

  let discount404 = 0;
  if (!operable) {
    discount404 = Math.round(subtotal * (config.inoperableDiscountPct / 100) * 100) / 100;
    subtotal -= discount404;
    notes.push(
      `404 discount: ${config.inoperableDiscountPct}% off because the motorcycle is inoperable.`
    );
  }

  const total = Math.round(subtotal * 100) / 100;
  const depositDue = Math.round(total * 50) / 100;

  return {
    currency: 'usd',
    subtotal: Math.round((base + enclosedPremium) * 100) / 100,
    enclosedPremium: Math.round(enclosedPremium * 100) / 100,
    seasonalMultiplier,
    discount404,
    i285Applied,
    total,
    depositDue,
    breakdown: {
      miles,
      perMile,
      base: Math.round(base * 100) / 100,
      minimum,
      seasonalName,
      notes,
    },
  };
}

module.exports = { calculateQuote, getRateConfig, seasonalMultiplierFor };
