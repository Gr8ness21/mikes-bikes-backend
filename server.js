require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { connectDb } = require('./src/config/db');
const User = require('./src/models/User');
const RateConfig = require('./src/models/RateConfig');
const stripeWebhook = require('./src/routes/stripe');

const app = express();
const port = Number(process.env.PORT) || 5001;

function allowOrigin(origin) {
  if (!origin) return true;
  const configured = process.env.CLIENT_URL || 'http://localhost:5173';
  if (origin === configured) return true;
  return (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
    /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (allowOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for ${origin}`));
    },
    credentials: true,
  })
);

app.use('/api/stripe', stripeWebhook);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, brand: "Mike's Bikes Transportation Services" });
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/quotes', require('./src/routes/quotes'));
app.use('/api/vehicles', require('./src/routes/vehicles'));
app.use('/api/bookings', require('./src/routes/bookings'));
app.use('/api/availability', require('./src/routes/availability'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/contact', require('./src/routes/contact'));
app.use('/api/geo', require('./src/routes/geo'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      firstName: 'Mike',
      lastName: 'Admin',
      email,
      phone: '2674046453',
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
    });
    console.log(`Seeded admin ${email}`);
  }
  if (!(await RateConfig.findOne({ key: 'default' }))) {
    await RateConfig.create(RateConfig.defaults());
  }
}

async function start() {
  await connectDb();
  await ensureAdmin();
  app.listen(port, '0.0.0.0', () => {
    console.log(`Mike's Bikes API listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
