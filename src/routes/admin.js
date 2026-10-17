const fs = require('fs');
const path = require('path');
const express = require('express');
const RateConfig = require('../models/RateConfig');
const BlackoutDate = require('../models/BlackoutDate');
const SeasonalRate = require('../models/SeasonalRate');
const PartnerInquiry = require('../models/PartnerInquiry');
const EmergencyRequest = require('../models/EmergencyRequest');
const GalleryItem = require('../models/GalleryItem');
const { authRequired, requireRole } = require('../middleware/auth');
const { galleryUpload, galleryDir } = require('../middleware/upload');
const { persistTop3 } = require('../services/galleryPersist');
const { getRateConfig } = require('../services/quote');
const { parseDay, startOfDay, endOfDay } = require('../utils/dates');

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
  const seasonal = await SeasonalRate.create({
    name,
    startDate: startOfDay(parseDay(startDate)),
    endDate: endOfDay(parseDay(endDate)),
    multiplier,
    note,
  });
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
    startDate: startOfDay(parseDay(startDate)),
    endDate: endOfDay(parseDay(endDate)),
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

router.get('/emergencies', async (_req, res) => {
  const emergencies = await EmergencyRequest.find().sort({ createdAt: -1 });
  res.json({ emergencies });
});

function kindFromMime(mime) {
  return String(mime).startsWith('video/') ? 'video' : 'image';
}

function boolField(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === 'on' || value === '1';
}

router.get('/gallery', async (_req, res) => {
  const items = await GalleryItem.find().sort({ order: 1, createdAt: 1 });
  res.json({ items });
});

router.post('/gallery', galleryUpload.array('files', 20), async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ message: 'Choose photos or videos to upload' });
  }
  const last = await GalleryItem.findOne().sort({ order: -1 });
  let order = last ? last.order + 1 : 0;
  const showOnHome = boolField(req.body.showOnHome, true);
  const showOnAbout = boolField(req.body.showOnAbout, true);
  const alt = String(req.body.alt || '').trim();
  const items = await GalleryItem.create(
    files.map((file) => {
      const storedName = file.filename;
      const doc = {
        originalName: file.originalname,
        storedName,
        url: `/uploads/gallery/${storedName}`,
        mimeType: file.mimetype,
        kind: kindFromMime(file.mimetype),
        alt,
        showOnHome,
        showOnAbout,
        order: order++,
      };
      return doc;
    })
  );
  await persistTop3();
  const saved = await GalleryItem.find({ _id: { $in: items.map((item) => item._id) } }).sort({
    order: 1,
    createdAt: 1,
  });
  res.status(201).json({ items: saved });
});

router.put('/gallery/order', async (req, res) => {
  const ids = req.body.ids;
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ message: 'ids array required' });
  }
  await Promise.all(ids.map((id, index) => GalleryItem.findByIdAndUpdate(id, { order: index })));
  await persistTop3();
  const items = await GalleryItem.find().sort({ order: 1, createdAt: 1 });
  res.json({ items });
});

router.patch('/gallery/:id', async (req, res) => {
  const item = await GalleryItem.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Media not found' });
  if (req.body.alt != null) item.alt = String(req.body.alt);
  if (req.body.showOnHome != null) item.showOnHome = boolField(req.body.showOnHome, item.showOnHome);
  if (req.body.showOnAbout != null) item.showOnAbout = boolField(req.body.showOnAbout, item.showOnAbout);
  await item.save();
  res.json({ item });
});

router.delete('/gallery/:id', async (req, res) => {
  const item = await GalleryItem.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Media not found' });
  const filePath = path.join(galleryDir, item.storedName);
  fs.unlink(filePath, () => {});
  await persistTop3();
  res.json({ ok: true });
});

module.exports = router;
