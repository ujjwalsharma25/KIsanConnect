const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }, // bcrypt hash, never plain text
  role: { type: String, enum: ['farmer', 'buyer'], required: true },
  buyerType: { type: String, enum: ['', 'retail', 'caterer', 'hostel', 'society', 'wholesale'], default: '' },
  location: { type: String, default: '' },
  recoveryHash: { type: String, default: '' },        // bcrypt hash of the 4-6 digit recovery PIN (used by 'Forgot password')
  recoveryFails: { type: Number, default: 0 },
  recoveryLockUntil: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', userSchema);
