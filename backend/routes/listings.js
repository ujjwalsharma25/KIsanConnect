const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { SHELF_LIFE } = require('../config');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),               // keep the bytes in memory -> saved into MongoDB (not the ephemeral disk)
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only images allowed'))
});

// attach booked/remaining (group buying) and the farmer's trust rating
async function enrich(listings) {
  const ids = listings.map(l => l._id), farmers = [...new Set(listings.map(l => String(l.farmer)))];
  const [bk, rt] = await Promise.all([
    Order.aggregate([{ $match: { listing: { $in: ids }, status: { $ne: 'refunded' } } }, { $group: { _id: '$listing', booked: { $sum: '$qty' } } }]),
    Order.aggregate([{ $match: { rating: { $exists: true } } }, { $group: { _id: '$farmer', avg: { $avg: '$rating' }, count: { $sum: 1 } } }])
  ]);
  const bmap = Object.fromEntries(bk.map(a => [String(a._id), a.booked]));
  const rmap = Object.fromEntries(rt.filter(r => farmers.includes(String(r._id))).map(r => [String(r._id), { avg: r.avg, count: r.count }]));
  return listings.map(l => {
    const booked = bmap[String(l._id)] || 0;
    const life = l.shelfLifeDays || 14, ageDays = (Date.now() - new Date(l.harvestDate || l.createdAt)) / 864e5;
    const daysLeft = Math.max(0, Math.ceil(life - ageDays));
    return { ...l.toObject(), booked, remaining: Math.max(0, l.quantityQuintal - booked), farmerRating: rmap[String(l.farmer)] || null,
      daysLeft, freshnessPct: Math.max(0, Math.min(100, Math.round((daysLeft / life) * 100))), urgent: daysLeft <= Math.max(1, Math.round(life * 0.25)) };
  });
}

router.post('/', auth, upload.single('photo'), async (req, res) => {
  if (req.userRole !== 'farmer') return res.status(403).json({ error: 'Only farmers can list crops.' });
  const { crop, quantityQuintal, rate, location, route, phone, grade, organic, harvestDate } = req.body;
  if (!crop || !quantityQuintal || !rate) return res.status(400).json({ error: 'Crop, quantity and rate are required.' });
  try {
    const me = await User.findById(req.userId);
    const key = String(crop).trim().toLowerCase();
    const shelfLifeDays = SHELF_LIFE[key] || SHELF_LIFE.default;
    let hd = harvestDate ? new Date(harvestDate) : new Date();
    if (isNaN(hd) || hd > new Date()) hd = new Date();
    const listing = await Listing.create({
      crop, quantityQuintal, rate, harvestDate: hd, shelfLifeDays, location: location || me.location, route: route || '',
      grade: ['A', 'B', 'C'].includes(grade) ? grade : 'A', organic: organic === 'true' || organic === 'on',
      photo: req.file ? { data: req.file.buffer, contentType: req.file.mimetype } : undefined,
      farmer: me._id, farmerName: me.name, farmerPhone: phone || me.phone
    });
    if (req.file) { listing.photoUrl = '/api/listings/' + listing._id + '/photo'; await listing.save(); }
    const out = listing.toObject(); delete out.photo;
    res.status(201).json(out);
  } catch (e) { res.status(500).json({ error: 'Could not create listing.' }); }
});

// public image endpoint (an <img> tag cannot send the JWT); cached by the browser
router.get('/:id/photo', async (req, res) => {
  try {
    const l = await Listing.findById(req.params.id).select('+photo');
    if (!l || !l.photo || !l.photo.data) return res.status(404).end();
    res.set('Content-Type', l.photo.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=604800');
    res.send(l.photo.data);
  } catch (e) { res.status(404).end(); }
});

// marketplace: active lots that still have quantity left
router.get('/', auth, async (req, res) => {
  try {
    const listings = await Listing.find({ status: 'active' }).sort({ createdAt: -1 }).limit(200);
    res.json((await enrich(listings)).filter(l => l.remaining > 0));
  } catch (e) { res.status(500).json({ error: 'Could not fetch listings.' }); }
});

router.get('/mine', auth, async (req, res) => {
  try { res.json(await enrich(await Listing.find({ farmer: req.userId }).sort({ createdAt: -1 }))); }
  catch (e) { res.status(500).json({ error: 'Could not fetch your listings.' }); }
});

// QR poster for a lot: scanning opens the app straight on this lot
router.get('/:id/qr', auth, async (req, res) => {
  try {
    const l = await Listing.findById(req.params.id);
    if (!l) return res.status(404).json({ error: 'Lot not found.' });
    const url = `${req.protocol}://${req.get('host')}/?lot=${l._id}`;
    res.json({ url, dataUrl: await QRCode.toDataURL(url, { margin: 1, width: 320 }) });
  } catch (e) { res.status(500).json({ error: 'Could not create QR.' }); }
});

// farmer closes / withdraws a lot
router.patch('/:id/close', auth, async (req, res) => {
  try {
    const l = await Listing.findOneAndUpdate({ _id: req.params.id, farmer: req.userId }, { status: 'closed' }, { new: true });
    if (!l) return res.status(404).json({ error: 'Lot not found.' });
    res.json(l);
  } catch (e) { res.status(500).json({ error: 'Could not close lot.' }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const l = await Listing.findById(req.params.id);
    if (!l) return res.status(404).json({ error: 'Lot not found.' });
    res.json((await enrich([l]))[0]);
  } catch (e) { res.status(404).json({ error: 'Lot not found.' }); }
});

module.exports = router;
