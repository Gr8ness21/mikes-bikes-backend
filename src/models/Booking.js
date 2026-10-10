const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    serviceType: {
      type: String,
      enum: ['emergency', 'scheduled', 'gas', 'tire'],
      required: true,
    },
    transportType: { type: String, enum: ['open', 'enclosed'], default: 'open' },
    pickupAddress: { type: String, required: true },
    dropoffAddress: { type: String, required: true },
    pickup: {
      lat: Number,
      lng: Number,
    },
    dropoff: {
      lat: Number,
      lng: Number,
    },
    scheduledDate: { type: Date },
    miles: { type: Number, required: true },
    insideI285: { type: Boolean, default: false },
    operable: { type: Boolean, default: true },
    quote: {
      currency: { type: String, default: 'usd' },
      subtotal: Number,
      enclosedPremium: Number,
      seasonalMultiplier: Number,
      discount404: Number,
      i285Applied: Boolean,
      total: Number,
      depositDue: Number,
      breakdown: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: [
        'quoted',
        'pending_deposit',
        'deposit_paid',
        'scheduled',
        'cancelled',
        'in_transit',
        'delivered',
      ],
      default: 'pending_deposit',
    },
    stripePaymentIntentId: String,
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
