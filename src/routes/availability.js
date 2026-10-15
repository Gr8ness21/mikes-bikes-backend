const express = require('express');
const BlackoutDate = require('../models/BlackoutDate');
const Booking = require('../models/Booking');
const { getRateConfig } = require('../services/quote');
const { startOfDay, endOfDay } = require('../utils/dates');

const router = express.Router();

router.get('/', async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 90 * 86400000);
  const config = await getRateConfig();
  const blackouts = await BlackoutDate.find({
    startDate: { $lte: to },
    endDate: { $gte: from },
  });
  const bookings = await Booking.find({
    serviceType: 'scheduled',
    status: { $in: ['pending_deposit', 'deposit_paid', 'scheduled', 'in_transit'] },
    scheduledDate: { $gte: from, $lte: to },
  }).select('scheduledDate');

  const blocked = [];
  const cursor = startOfDay(from);
  const last = startOfDay(to);
  while (cursor <= last) {
    const day = new Date(cursor);
    const blacked = blackouts.some((b) => day >= startOfDay(b.startDate) && day <= endOfDay(b.endDate));
    const taken = bookings.filter((b) => startOfDay(b.scheduledDate).getTime() === day.getTime())
      .length;
    if (blacked || taken >= config.dailyScheduledCapacity) {
      blocked.push(day.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  res.json({ blocked, capacity: config.dailyScheduledCapacity });
});

module.exports = router;
