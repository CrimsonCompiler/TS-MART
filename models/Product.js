const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    category: { type: String, default: 'General' },
    stock: { type: Number, default: 50, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', ProductSchema);
