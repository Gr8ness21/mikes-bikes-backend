const express = require('express');
const GalleryItem = require('../models/GalleryItem');

const router = express.Router();

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.slot === 'home') filter.showOnHome = true;
  if (req.query.slot === 'about') filter.showOnAbout = true;
  const items = await GalleryItem.find(filter).sort({ order: 1, createdAt: 1 });
  res.json({ items });
});

module.exports = router;
