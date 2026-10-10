const mongoose = require('mongoose');

const partnerInquirySchema = new mongoose.Schema(
  {
    organization: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PartnerInquiry', partnerInquirySchema);
