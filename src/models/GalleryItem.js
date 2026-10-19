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
    top3: { type: Boolean, default: false },
    top5: { type: Boolean, default: false },
    durable: { type: Boolean, default: false },
    gridFsId: { type: mongoose.Schema.Types.ObjectId },
    data: { type: Buffer, select: false },
  },
  { timestamps: true }
);

galleryItemSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.data;
    return ret;
  },
});

module.exports = mongoose.model('GalleryItem', galleryItemSchema);
