const express = require('express');
const Listing = require('../models/Listing');
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { PLATFORM_FEE, MODES, AUTO_RELEASE_MINUTES } = require('../config');
const router = express.Router();

const log = (o, status, note) => { o.status = status; o.events.push({ status, at: new Date(), note }); };

// Escrow safety net: if the buyer neither confirms nor disputes within the window after shipping,
// the money is auto-released to the farmer. Runs lazily whenever orders are read.
async function autoReleaseDue(filter) {
  const due = await Order.find({ ...filter, status: 'shipped', autoReleaseAt: { $lte: new Date() } });
  for (const o of due) { log(o, 'released', 'Auto-released: no dispute raised in time'); o.releasedAt = new Date(); o.autoReleased = true; await o.save(); }
}

// BUYER places an order -> money goes to ESCROW (simulated wallet)
router.post('/', auth, async (req, res) => {
  if (req.userRole !== 'buyer') return res.status(403).json({ error: 'Only buyers can place orders.' });
  const { listingId, mode = 'pickup' } = req.body;
  const qty = Number(req.body.qty);
  if (!(mode in MODES)) return res.status(400).json({ error: 'Invalid delivery mode.' });
  if (!qty || qty <= 0) return res.status(400).json({ error: 'Enter a valid quantity.' });
  try {
    const listing = await Listing.findById(listingId);
    if (!listing || listing.status !== 'active') return res.status(404).json({ error: 'Lot not available.' });
    // refunded orders free their quantity back to the lot
    const agg = await Order.aggregate([{ $match: { listing: listing._id, status: { $ne: 'refunded' } } }, { $group: { _id: null, b: { $sum: '$qty' } } }]);
    const remaining = listing.quantityQuintal - (agg[0] ? agg[0].b : 0);
    if (qty > remaining) return res.status(400).json({ error: `Only ${remaining} quintal left in this lot.` });
    const buyer = await User.findById(req.userId);
    const subtotal = qty * listing.rate;
    const fee = Math.round(subtotal * PLATFORM_FEE);
    const deliveryFee = qty * MODES[mode];
    const order = await Order.create({
      listing: listing._id, crop: listing.crop, qty, rate: listing.rate, subtotal, fee, mode, deliveryFee,
      total: subtotal + fee + deliveryFee,
      buyer: buyer._id, buyerName: buyer.name, buyerPhone: buyer.phone,
      farmer: listing.farmer, farmerName: listing.farmerName, farmerPhone: listing.farmerPhone,
      events: [{ status: 'escrow', at: new Date(), note: 'Payment held in escrow' }]
    });
    res.status(201).json(order);
  } catch (e) { res.status(500).json({ error: 'Could not place order.' }); }
});

// MY orders (buyer sees purchases, farmer sees incoming orders)
router.get('/mine', auth, async (req, res) => {
  try {
    const filter = req.userRole === 'farmer' ? { farmer: req.userId } : { buyer: req.userId };
    await autoReleaseDue(filter);
    res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
  } catch (e) { res.status(500).json({ error: 'Could not fetch orders.' }); }
});

// FARMER marks shipped -> starts the dispute / auto-release window
router.patch('/:id/ship', auth, async (req, res) => {
  try {
    const o = await Order.findOne({ _id: req.params.id, farmer: req.userId, status: 'escrow' });
    if (!o) return res.status(404).json({ error: 'Order not found or already shipped.' });
    log(o, 'shipped', 'Farmer shipped the lot'); o.shippedAt = new Date();
    o.autoReleaseAt = new Date(Date.now() + AUTO_RELEASE_MINUTES * 60000);
    await o.save(); res.json(o);
  } catch (e) { res.status(500).json({ error: 'Could not update order.' }); }
});

// BUYER confirms delivery -> escrow released to farmer
router.patch('/:id/release', auth, async (req, res) => {
  try {
    const o = await Order.findOne({ _id: req.params.id, buyer: req.userId, status: { $in: ['escrow', 'shipped'] } });
    if (!o) return res.status(404).json({ error: 'Order not found or already released.' });
    log(o, 'released', 'Buyer confirmed delivery'); o.releasedAt = new Date(); await o.save(); res.json(o);
  } catch (e) { res.status(500).json({ error: 'Could not release payment.' }); }
});

// BUYER raises a dispute while the money is still held (pauses auto-release)
router.patch('/:id/dispute', auth, async (req, res) => {
  const reason = String(req.body.reason || '').trim().slice(0, 300);
  if (reason.length < 5) return res.status(400).json({ error: 'Please describe the problem (min 5 characters).' });
  try {
    const o = await Order.findOne({ _id: req.params.id, buyer: req.userId, status: { $in: ['escrow', 'shipped'] } });
    if (!o) return res.status(404).json({ error: 'Order not found or cannot be disputed now.' });
    log(o, 'disputed', reason); o.disputeReason = reason; o.disputedAt = new Date(); o.autoReleaseAt = undefined; await o.save(); res.json(o);
  } catch (e) { res.status(500).json({ error: 'Could not raise dispute.' }); }
});

// BUYER withdraws the dispute -> back to shipped with a fresh window
router.patch('/:id/withdraw', auth, async (req, res) => {
  try {
    const o = await Order.findOne({ _id: req.params.id, buyer: req.userId, status: 'disputed' });
    if (!o) return res.status(404).json({ error: 'No open dispute on this order.' });
    log(o, 'shipped', 'Buyer withdrew the dispute'); o.autoReleaseAt = new Date(Date.now() + AUTO_RELEASE_MINUTES * 60000); await o.save(); res.json(o);
  } catch (e) { res.status(500).json({ error: 'Could not withdraw dispute.' }); }
});

// FARMER accepts the dispute -> escrow refunded to buyer
router.patch('/:id/refund', auth, async (req, res) => {
  try {
    const o = await Order.findOne({ _id: req.params.id, farmer: req.userId, status: 'disputed' });
    if (!o) return res.status(404).json({ error: 'No open dispute on this order.' });
    log(o, 'refunded', 'Farmer accepted the dispute — escrow refunded to buyer'); await o.save(); res.json(o);
  } catch (e) { res.status(500).json({ error: 'Could not refund.' }); }
});

// BUYER rates the farmer after payment is released (trust score)
router.patch('/:id/rate', auth, async (req, res) => {
  const rating = Number(req.body.rating);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Rating must be 1 to 5.' });
  try {
    const o = await Order.findOne({ _id: req.params.id, buyer: req.userId, status: 'released', rating: { $exists: false } });
    if (!o) return res.status(404).json({ error: 'Order not found or already rated.' });
    o.rating = rating; o.review = String(req.body.review || '').slice(0, 300); await o.save(); res.json(o);
  } catch (e) { res.status(500).json({ error: 'Could not save rating.' }); }
});

module.exports = router;
