const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    _singleton: { type: Boolean, default: true, unique: true },
    siteName:   { type: String, default: 'Lata Electric' },
    phone:      { type: String, default: '01700-000000' },
    email:      String,
    address:    { type: String, default: 'Ka/6 Nadda, Gulshan, Dhaka-1212' },
    hours:      { type: String, default: 'Sat–Thu: 9am – 8pm' },
    heroTitle:  String,
    heroSubtitle: String,
    announcementBar: String,
    shipping: {
      inside:  { type: Number, default: 60 },
      outside: { type: Number, default: 120 },
    },
    freeDeliveryThreshold: { type: Number, default: 1000 },
    deliveryTime: {
      inside:  { type: String, default: 'Same Day / Next Day' },
      outside: { type: String, default: '2–4 Business Days' },
    },
    paymentMethods: [{ type: String, enum: ['Cash on Delivery', 'bKash', 'Nagad'] }],
    bkashNumber:       String,
    nagadNumber:       String,
    bkashInstructions: String,
    nagadInstructions: String,
    flashSaleActive:   { type: Boolean, default: false },
    flashSaleEnds:     Date,
    facebook:  String,
    whatsapp:  String,
    youtube:   String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
