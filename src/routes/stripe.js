const express = require('express');
const Stripe = require('stripe');
const Booking = require('../models/Booking');

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const booking = await Booking.findOne({ stripePaymentIntentId: intent.id });
    if (booking && booking.status === 'pending_deposit') {
      booking.status = booking.serviceType === 'scheduled' ? 'scheduled' : 'deposit_paid';
      await booking.save();
    }
  }

  res.json({ received: true });
});

module.exports = router;
