const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:     String,
  price:    Number,
  qty:      { type: Number, min: 1 },
  image:    String,
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },   // human-readable: LE-XXXXXX
    customer: {
      name:     { type: String, required: true },
      phone:    { type: String, required: true },
      address:  { type: String, required: true },
      city:     String,
      district: String,
    },
    items:         [orderItemSchema],
    subtotal:      Number,
    deliveryCharge:Number,
    total:         Number,
    paymentMethod: { type: String, enum: ['Cash on Delivery', 'bKash', 'Nagad'], required: true },
    transactionId: String,
    status: {
      type:    String,
      enum:    ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    notes:       String,
    statusHistory: [{
      status:    String,
      changedAt: { type: Date, default: Date.now },
      note:      String,
    }],
  },
  { timestamps: true }
);

orderSchema.pre('save', function (next) {
  if (!this.orderId) {
    this.orderId = 'LE-' + Date.now().toString(36).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
