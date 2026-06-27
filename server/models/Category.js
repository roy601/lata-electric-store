const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, unique: true, trim: true },
    slug:     { type: String, unique: true, lowercase: true },
    icon:     { type: String, default: 'bi-grid' },
    color:    { type: String, default: '#c0392b' },
    isActive: { type: Boolean, default: true },
    order:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
