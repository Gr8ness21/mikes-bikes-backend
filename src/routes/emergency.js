const express = require('express');
const EmergencyRequest = require('../models/EmergencyRequest');

const router = express.Router();

router.post('/', async (req, res) => {
  const {
    name,
    email,
    phone,
    pickupAddress,
    dropoffAddress = '',
    year = '',
    make = '',
    model = '',
    operable = true,
    notes = '',
  } = req.body;
  if (!name || !email || !phone || !pickupAddress) {
    return res.status(400).json({ message: 'Name, email, phone, and pickup location are required' });
  }
  const request = await EmergencyRequest.create({
    name,
    email,
    phone,
    pickupAddress,
    dropoffAddress,
    year,
    make,
    model,
    operable: operable !== false && operable !== 'false',
    notes,
  });
  res.status(201).json({ request });
});

module.exports = router;
