const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true },
    slug:          { type: String, unique: true, lowercase: true },
    categoryId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand:         { type: String, trim: true },
    sku:           { type: String, unique: true, sparse: true, trim: true },
    description:   { type: String },
    price:         { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    stock:         { type: Number, default: 0, min: 0 },
    image:         { type: String },
    images:        [{ type: String }],
    featured:      { type: Boolean, default: false },
    topSell:       { type: Boolean, default: false },
    flashSale:     { type: Boolean, default: false },
    flashPrice:    { type: Number },
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
