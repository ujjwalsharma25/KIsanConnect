const mongoose = require('mongoose');
const listingSchema = new mongoose.Schema({
  crop: { type: String, required: true, trim: true },
  quantityQuintal: { type: Number, required: true, min: 0.1 },
  rate: { type: Number, required: true, min: 1 },
  location: { type: String, default: '' },
  route: { type: String, default: '' },              // Kisan Haat weekly route
  grade: { type: String, enum: ['A', 'B', 'C'], default: 'A' },
  organic: { type: Boolean, default: false },
  harvestDate: { type: Date, default: Date.now },
  shelfLifeDays: { type: Number, default: 14 },
  photoUrl: { type: String, default: '' },
  photo: { type: { data: Buffer, contentType: String }, select: false },   // stored in MongoDB so it survives redeploys
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmerName: String,
  farmerPhone: String,
  createdAt: { type: Date, default: Date.now }
});
listingSchema.index({ crop: 1 });
module.exports = mongoose.model('Listing', listingSchema);
