const express = require('express');
const { reverseGeocode, drivingRoute, findPlaces } = require('../services/geo');

const router = express.Router();

function formatAddress({ street, city, state, zip }) {
  return [street, city, state, zip].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
}

router.post('/lookup', async (req, res) => {
  try {
    const { street, city, state, zip } = req.body;
    if (!city || !state) {
      return res.status(400).json({ message: 'City and state are required' });
    }
    const result = await findPlaces({ street, city, state, zip });
    res.json({
      place: result.place,
      suggestions: result.suggestions || [],
      message: result.message,
      query: formatAddress({ street, city, state, zip }),
    });
  } catch (err) {
    res.status(400).json({ message: err.message, suggestions: err.suggestions || [] });
  }
});

router.post('/reverse', async (req, res) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'lat and lng are required' });
    }
    const place = await reverseGeocode(lat, lng);
    res.json({ place });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/route', async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from?.lat || !to?.lat) {
      return res.status(400).json({ message: 'from and to coordinates are required' });
    }
    const route = await drivingRoute(from, to);
    res.json(route);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
