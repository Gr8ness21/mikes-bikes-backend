const express = require('express');
const Stripe = require('stripe');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const BlackoutDate = require('../models/BlackoutDate');
const { authRequired } = require('../middleware/auth');
const { resolveTrip } = require('../services/geo');
const { calculateQuote, getRateConfig } = require('../services/quote');
const { parseDay, startOfDay, endOfDay } = require('../utils/dates');

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing from .env');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

router.use(authRequired);

router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { member: req.user._id };
  const bookings = await Booking.find(filter)
    .populate('vehicle')
    .populate('member', 'firstName lastName email phone')
    .sort({ createdAt: -1 });
  res.json({ bookings });
});

router.get('/:id', async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('vehicle').populate(
    'member',
    'firstName lastName email phone'
  );
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const isOwner = booking.member._id.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin' && req.user.role !== 'driver') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  res.json({ booking });
});

router.post('/', async (req, res) => {
  try {
    const {
      vehicleId,
      pickupAddress,
      dropoffAddress,
      transportType = 'open',
      serviceType = 'scheduled',
      scheduledDate,
      notes,
      year,
      make,
      model,
      operable,
    } = req.body;

    if (!pickupAddress || !dropoffAddress) {
      return res.status(400).json({ message: 'Pickup and drop-off are required' });
    }

    if (serviceType === 'scheduled') {
      if (!scheduledDate) {
        return res.status(400).json({ message: 'Scheduled date is required' });
      }
      const day = parseDay(scheduledDate);
      const blacked = await BlackoutDate.findOne({
        startDate: { $lte: endOfDay(day) },
        endDate: { $gte: startOfDay(day) },
      });
      if (blacked) {
        return res.status(409).json({ message: 'That date is blacked out' });
      }
      const config = await getRateConfig();
      const start = startOfDay(day);
      const end = endOfDay(day);
      const taken = await Booking.countDocuments({
        serviceType: 'scheduled',
        status: { $in: ['pending_deposit', 'deposit_paid', 'scheduled', 'in_transit'] },
        scheduledDate: { $gte: start, $lte: end },
      });
      if (taken >= config.dailyScheduledCapacity) {
        return res.status(409).json({ message: 'That date is already booked' });
      }
    }

    let vehicle = null;
    let isOperable = operable != null ? Boolean(operable) : true;
    if (vehicleId) {
      vehicle = await Vehicle.findOne({ _id: vehicleId, owner: req.user._id });
      if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
      isOperable = vehicle.operable;
    } else if (year && make && model) {
      vehicle = await Vehicle.create({
        owner: req.user._id,
        year,
        make,
        model,
        operable: isOperable,
      });
    }

    const trip = await resolveTrip(pickupAddress, dropoffAddress);
    const quote = await calculateQuote({
      miles: trip.miles,
      transportType,
      operable: isOperable,
      insideI285: trip.insideI285,
      forDate: scheduledDate,
    });

    let paymentIntentId;
    let clientSecret = null;
    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(quote.depositDue * 100),
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          memberId: req.user._id.toString(),
          serviceType,
        },
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
    }

    const booking = await Booking.create({
      member: req.user._id,
      vehicle: vehicle?._id,
      serviceType,
      transportType,
      pickupAddress,
      dropoffAddress,
      pickup: { lat: trip.pickup.lat, lng: trip.pickup.lng },
      dropoff: { lat: trip.dropoff.lat, lng: trip.dropoff.lng },
      scheduledDate: scheduledDate ? startOfDay(scheduledDate) : undefined,
      miles: trip.miles,
      insideI285: trip.insideI285,
      operable: isOperable,
      quote,
      status: 'pending_deposit',
      stripePaymentIntentId: paymentIntentId,
      notes,
    });

    if (paymentIntentId) {
      const stripe = getStripe();
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          memberId: req.user._id.toString(),
          bookingId: booking._id.toString(),
          serviceType,
        },
      });
    }

    res.status(201).json({
      booking,
      clientSecret,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/payment-secret', async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const isOwner = booking.member.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (!process.env.STRIPE_SECRET_KEY || !booking.stripePaymentIntentId) {
    return res.json({ clientSecret: null, stripeConfigured: false, booking });
  }
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
    res.json({
      clientSecret: intent.client_secret,
      stripeConfigured: true,
      booking,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/simulate-deposit', async (req, res) => {
  if (process.env.STRIPE_SECRET_KEY) {
    return res.status(400).json({ message: 'Stripe is configured — complete payment with checkout' });
  }
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const isOwner = booking.member.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  booking.status = booking.serviceType === 'scheduled' ? 'scheduled' : 'deposit_paid';
  await booking.save();
  res.json({ booking, simulated: true });
});

router.post('/:id/confirm-deposit', async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const isOwner = booking.member.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (!booking.stripePaymentIntentId) {
    return res.status(400).json({ message: 'No Stripe payment on this booking' });
  }
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
    if (intent.status !== 'succeeded') {
      return res.status(400).json({ message: `Payment status is ${intent.status}` });
    }
    booking.status = booking.serviceType === 'scheduled' ? 'scheduled' : 'deposit_paid';
    await booking.save();
    res.json({ booking });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const isOwner = booking.member.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  if (req.body.status === 'cancelled') {
    if (!['quoted', 'pending_deposit', 'deposit_paid', 'scheduled'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking can no longer be cancelled' });
    }
    booking.status = 'cancelled';
    await booking.save();
    return res.json({ booking });
  }

  if (isOwner && booking.status === 'pending_deposit' && req.body.scheduledDate) {
    booking.scheduledDate = req.body.scheduledDate;
    await booking.save();
    return res.json({ booking });
  }

  if (req.user.role === 'admin' && req.body.status) {
    booking.status = req.body.status;
    await booking.save();
    return res.json({ booking });
  }

  return res.status(400).json({ message: 'Nothing to update' });
});

module.exports = router;
