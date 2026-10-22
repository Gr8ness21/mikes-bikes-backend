const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const GalleryItem = require('../models/GalleryItem');
const { galleryDir } = require('../middleware/upload');

const TOP_COUNT = 5;

function durableUrl(id) {
  return `/api/gallery/file/${id}`;
}

function galleryBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'gallery' });
}

function uploadFromPath(item, filePath) {
  return new Promise((resolve, reject) => {
    const upload = galleryBucket().openUploadStream(item.storedName, {
      contentType: item.mimeType,
      metadata: { galleryItemId: String(item._id) },
    });
    fs.createReadStream(filePath)
      .pipe(upload)
      .on('error', reject)
      .on('finish', () => resolve(upload.id));
  });
}

async function deleteGridFs(id) {
  if (!id) return;
  try {
    await galleryBucket().delete(id);
  } catch {
    /* already gone */
  }
}

async function persistGallery() {
  const items = await GalleryItem.find().select('+data').sort({ order: 1, createdAt: 1 });
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const featured = index < TOP_COUNT;
    item.top5 = featured;
    item.top3 = featured;
    if (!item.gridFsId) {
      const filePath = path.join(galleryDir, item.storedName);
      if (fs.existsSync(filePath)) {
        try {
          item.gridFsId = await uploadFromPath(item, filePath);
        } catch (err) {
          console.error(`Could not store gallery file ${item._id}:`, err.message);
        }
      }
    }
    const durable = Boolean(item.gridFsId || (item.data && item.data.length));
    item.durable = durable;
    if (durable) item.url = durableUrl(item._id);
    try {
      await item.save();
    } catch (err) {
      console.error(`Could not persist gallery item ${item._id}:`, err.message);
    }
  }
}

module.exports = {
  persistGallery,
  persistTop5: persistGallery,
  persistTop3: persistGallery,
  durableUrl,
  galleryBucket,
  deleteGridFs,
};
