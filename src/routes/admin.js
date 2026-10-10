const express = require('express');
const RateConfig = require('../models/RateConfig');
const BlackoutDate = require('../models/BlackoutDate');
const SeasonalRate = require('../models/SeasonalRate');
const PartnerInquiry = require('../models/PartnerInquiry');
const { authRequired, requireRole } = require('../middleware/auth');
const { getRateConfig } = require('../services/quote');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

router.get('/rates', async (_req, res) => {
  const config = await getRateConfig();
  const seasonal = await SeasonalRate.find().sort({ startDate: 1 });
  res.json({ config, seasonal });
});

router.put('/rates', async (req, res) => {
  const config = await getRateConfig();
  const allowed = [
    'brackets',
    'enclosedMultiplier',
    'inoperableDiscountPct',
    'i285FlatRate',
    'minimumOpen',
    'minimumEnclosed',
    'dailyScheduledCapacity',
  ];
  for (const key of allowed) {
    if (req.body[key] != null) config[key] = req.body[key];
  }
  await config.save();
  res.json({ config });
});

router.post('/seasonal', async (req, res) => {
  const { name, startDate, endDate, multiplier, note } = req.body;
  if (!name || !startDate || !endDate || multiplier == null) {
    return res.status(400).json({ message: 'name, dates, and multiplier are required' });
  }
  const seasonal = await SeasonalRate.create({ name, startDate, endDate, multiplier, note });
  res.status(201).json({ seasonal });
});

router.delete('/seasonal/:id', async (req, res) => {
  await SeasonalRate.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

router.get('/blackouts', async (_req, res) => {
  const blackouts = await BlackoutDate.find().sort({ startDate: 1 });
  res.json({ blackouts });
});

router.post('/blackouts', async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Start and end dates are required' });
  }
  const blackout = await BlackoutDate.create({
    startDate,
    endDate,
    reason,
    createdBy: req.user._id,
  });
  res.status(201).json({ blackout });
});

router.delete('/blackouts/:id', async (req, res) => {
  await BlackoutDate.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

router.get('/inquiries', async (_req, res) => {
  const inquiries = await PartnerInquiry.find().sort({ createdAt: -1 });
  res.json({ inquiries });
});

module.exports = router;
