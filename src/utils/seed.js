require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDb } = require('../config/db');
const User = require('../models/User');
const RateConfig = require('../models/RateConfig');

async function seed() {
  await connectDb();
  const email = (process.env.ADMIN_EMAIL || 'admin@mikesbikes.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  let admin = await User.findOne({ email });
  if (!admin) {
    admin = await User.create({
      firstName: 'Mike',
      lastName: 'Admin',
      email,
      phone: '2674046453',
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
    });
    console.log(`Admin created: ${email}`);
  } else if (admin.role !== 'admin') {
    admin.role = 'admin';
    await admin.save();
    console.log(`Existing user promoted to admin: ${email}`);
  } else {
    console.log(`Admin already exists: ${email}`);
  }

  const rates = await RateConfig.findOne({ key: 'default' });
  if (!rates) {
    await RateConfig.create(RateConfig.defaults());
    console.log('Default rate table created');
  }
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
