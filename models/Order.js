const mongoose = require('mongoose');
const { STAGES } = require('../utils/orderStatus');

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    image: { type: String, default: '' },
  },
  { _id: false }
);

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    house: { type: String, required: true, trim: true },     // house/street/area
    district: { type: String, required: true, trim: true },
    division: { type: String, required: true, trim: true },
    postcode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'Bangladesh' },
  },
  { _id: false }
);

const StatusTimestampsSchema = new mongoose.Schema(
  {
    placed: { type: Date, default: null },
    confirmed: { type: Date, default: null },
    shipped: { type: Date, default: null },
    outForDelivery: { type: Date, default: null },
    delivered: { type: Date, default: null },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [OrderItemSchema], required: true },
    customer: { type: CustomerSchema, required: true },
    paymentMethod: { type: String, default: 'COD' },
    currency: { type: String, default: 'BDT' },
    shipping: { type: Number, default: 0, min: 0 },
    status: { type: String, default: STAGES[0].label },
    statusTimestamps: { type: StatusTimestampsSchema, default: () => ({}) },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);