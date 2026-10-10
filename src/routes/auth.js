const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken, publicUser, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone: String(phone),
      passwordHash,
      role: 'member',
    });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
