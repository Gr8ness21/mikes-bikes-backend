const express = require('express');
const Vehicle = require('../models/Vehicle');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  const vehicles = await Vehicle.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json({ vehicles });
});

router.post('/', async (req, res) => {
  const { year, make, model, operable = true } = req.body;
  if (!year || !make || !model) {
    return res.status(400).json({ message: 'Year, make, and model are required' });
  }
  const vehicle = await Vehicle.create({
    owner: req.user._id,
    year,
    make,
    model,
    operable: Boolean(operable),
  });
  res.status(201).json({ vehicle });
});

router.patch('/:id', async (req, res) => {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, owner: req.user._id });
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  const { year, make, model, operable } = req.body;
  if (year != null) vehicle.year = year;
  if (make) vehicle.make = make;
  if (model) vehicle.model = model;
  if (operable != null) vehicle.operable = Boolean(operable);
  await vehicle.save();
  res.json({ vehicle });
});

router.delete('/:id', async (req, res) => {
  const vehicle = await Vehicle.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
  res.json({ ok: true });
});

module.exports = router;
