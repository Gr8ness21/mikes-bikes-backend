const express = require('express');
const { resolveTrip } = require('../services/geo');
const { calculateQuote } = require('../services/quote');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      pickupAddress,
      dropoffAddress,
      transportType = 'open',
      operable = true,
      serviceType = 'scheduled',
      scheduledDate,
    } = req.body;

    if (!pickupAddress || !dropoffAddress) {
      return res.status(400).json({ message: 'Pickup and drop-off addresses are required' });
    }

    const trip = await resolveTrip(pickupAddress, dropoffAddress);
    const quote = await calculateQuote({
      miles: trip.miles,
      transportType,
      operable: Boolean(operable),
      insideI285: trip.insideI285,
      forDate: scheduledDate || undefined,
    });

    res.json({
      serviceType,
      transportType,
      operable: Boolean(operable),
      pickupAddress,
      dropoffAddress,
      ...trip,
      quote,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
