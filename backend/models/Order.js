const mongoose = require('mongoose');
// Many buyers can each book part of one farmer lot => group buying.
const orderSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  crop: String,
  qty: { type: Number, required: true, min: 0.1 },
  rate: Number,
  subtotal: Number,
  fee: Number,
  mode: { type: String, enum: ['pickup', 'truck', 'society', 'hub'], default: 'pickup' },
  deliveryFee: Number,
  total: Number,
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  buyerName: String, buyerPhone: String,
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmerName: String, farmerPhone: String,
  status: { type: String, enum: ['escrow', 'shipped', 'released', 'disputed', 'refunded'], default: 'escrow' }, // escrow -> shipped -> released | disputed -> refunded
  rating: { type: Number, min: 1, max: 5 },   // buyer rates farmer after release
  review: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  events: [{ status: String, at: { type: Date, default: Date.now }, note: String, _id: false }], // timeline
  autoReleaseAt: Date, autoReleased: { type: Boolean, default: false },
  disputeReason: String, disputedAt: Date,
  shippedAt: Date,
  releasedAt: Date
});
module.exports = mongoose.model('Order', orderSchema);
