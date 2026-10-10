const express = require('express');
const PartnerInquiry = require('../models/PartnerInquiry');

const router = express.Router();

router.post('/', async (req, res) => {
  const { organization, name, email, phone = '', message } = req.body;
  if (!organization || !name || !email || !message) {
    return res.status(400).json({ message: 'Organization, name, email, and message are required' });
  }
  const inquiry = await PartnerInquiry.create({ organization, name, email, phone, message });
  res.status(201).json({ inquiry });
});

module.exports = router;
