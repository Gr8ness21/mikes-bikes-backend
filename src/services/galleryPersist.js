const fs = require('fs');
const path = require('path');
const GalleryItem = require('../models/GalleryItem');
const { galleryDir } = require('../middleware/upload');

const TOP3_COUNT = 3;
const MAX_BYTES = 12 * 1024 * 1024;

function durableUrl(id) {
  return `/api/gallery/file/${id}`;
}

async function persistTop3() {
  const items = await GalleryItem.find().select('+data').sort({ order: 1, createdAt: 1 });
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const top3 = index < TOP3_COUNT;
    item.top3 = top3;
    const hasData = Boolean(item.data && item.data.length);
    if (top3 && !hasData) {
      const filePath = path.join(galleryDir, item.storedName);
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        if (buf.length <= MAX_BYTES) item.data = buf;
      }
    }
    if (item.data && item.data.length) {
      item.durable = true;
      item.url = durableUrl(item._id);
    } else {
      item.durable = false;
    }
    try {
      await item.save();
    } catch (err) {
      console.error(`Could not persist gallery item ${item._id}:`, err.message);
    }
  }
}

module.exports = { persistTop3, durableUrl };
