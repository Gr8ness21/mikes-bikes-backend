const fs = require('fs');
const path = require('path');
const express = require('express');
const GalleryItem = require('../models/GalleryItem');
const { galleryDir } = require('../middleware/upload');
const { galleryBucket } = require('../services/galleryPersist');

const router = express.Router();

router.get('/file/:id', async (req, res) => {
  const item = await GalleryItem.findById(req.params.id).select('+data');
  if (!item) return res.status(404).json({ message: 'Media not found' });
  const filePath = path.join(galleryDir, item.storedName);
  res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  if (item.gridFsId) {
    const stream = galleryBucket().openDownloadStream(item.gridFsId);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ message: 'Media missing' });
    });
    return stream.pipe(res);
  }
  if (item.data && item.data.length) return res.send(item.data);
  return res.status(404).json({ message: 'Media missing' });
});

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.slot === 'home') filter.showOnHome = true;
  if (req.query.slot === 'about') filter.showOnAbout = true;
  const items = await GalleryItem.find(filter).sort({ order: 1, createdAt: 1 });
  res.json({ items });
});

module.exports = router;
