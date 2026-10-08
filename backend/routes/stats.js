const express = require('express');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const router = express.Router();

// Platform-wide totals (not scoped to the logged-in user) — real numbers, no estimates.
router.get('/impact', auth, async (req, res) => {
  try {
    const [farmers, buyers, listings, releasedOrders] = await Promise.all([
      User.countDocuments({ role: 'farmer' }),
      User.countDocuments({ role: 'buyer' }),
      Listing.countDocuments({}),
      Order.find({ status: 'released' }),
    ]);
    const gmv = releasedOrders.reduce((s, o) => s + (o.subtotal || 0), 0);
    res.json({
      farmers, buyers, listings,
      completedOrders: releasedOrders.length,
      gmv: Math.round(gmv),
    });
  } catch (e) {
    res.status(500).json({ error: 'Could not compute impact stats.' });
  }
});

module.exports = router;
