const mongoose = require('mongoose');

const galleryItemSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    kind: { type: String, enum: ['image', 'video'], required: true },
    alt: { type: String, default: '' },
    showOnHome: { type: Boolean, default: true },
    showOnAbout: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GalleryItem', galleryItemSchema);
