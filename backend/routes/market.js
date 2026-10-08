const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const ML = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// generic proxy to the Python ML service so the frontend only ever talks to this one API
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Free hosting puts the ML service to sleep after ~15 min idle; the first request then takes 30-60 s.
// So instead of failing instantly we retry for up to ~55 s while it wakes up.
async function proxy(path, res) {
  const deadline = Date.now() + 55000;
  let lastErr;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const r = await fetch(ML + path, { signal: AbortSignal.timeout(20000) });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('ML service is waking up (status ' + r.status + ')');
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.detail || 'Not found in mandi data.' });
      return res.json(data);
    } catch (e) {
      lastErr = e;
      if (Date.now() + 6000 > deadline) break;
      await sleep(6000);
    }
  }
  console.warn('ML service unreachable:', lastErr && lastErr.message);
  res.status(503).json({ error: 'AI/ML service is waking up', code: 'ML_WAKING' });
}

// Public + cheap: the frontend calls this as soon as the site opens so the sleeping ML service starts waking
// BEFORE the user needs it. Also reports whether it is up.
router.get('/warm', async (req, res) => {
  try {
    const r = await fetch(ML + '/health', { signal: AbortSignal.timeout(3000) });
    res.json({ up: r.ok });
  } catch (e) { res.json({ up: false }); }
});

// AI Market Intelligence: live average/min/max from THIS platform's own listings (Mongo)
router.get('/intelligence', auth, async (req, res) => {
  try {
    const Listing = require('../models/Listing');
    const rows = await Listing.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: { $toLower: '$crop' }, name: { $first: '$crop' }, avg: { $avg: '$rate' }, min: { $min: '$rate' }, max: { $max: '$rate' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 20 }
    ]);
    res.json(rows.map(r => ({ name: r.name, avg: Math.round(r.avg), min: r.min, max: r.max, count: r.count })));
  } catch (e) { res.status(500).json({ error: 'Could not compute market data.' }); }
});

// Real Agmarknet-trained model: fair price estimate for a crop (optionally state/district/market/variety/grade)
router.get('/fair-price', auth, (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  proxy('/fair-price?' + q, res);
});

// State-wise price comparison bar chart data
router.get('/compare', auth, (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  proxy('/compare?' + q, res);
});

// Cheapest / costliest individual mandis for a crop
router.get('/top-markets', auth, (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  proxy('/top-markets?' + q, res);
});

// Price spread (min-max gap) per crop - proxy for farm-gate-to-mandi margin
router.get('/spread', auth, (req, res) => {
  const q = new URLSearchParams(req.query).toString();
  proxy('/spread?' + q, res);
});

// list of crops available in the trained mandi dataset (for dropdowns / autocomplete)
router.get('/crops', auth, (req, res) => proxy('/crops', res));


// ── Official Agmarknet national snapshot (3 days) + MSP check, sell-now advisor, history, explainability ──
router.get('/benchmark', auth, (req, res) => proxy('/benchmark?' + new URLSearchParams(req.query).toString(), res));
router.get('/advisor', auth, (req, res) => proxy('/advisor?' + new URLSearchParams(req.query).toString(), res));
router.get('/onion-history', auth, (req, res) => proxy('/onion-history', res));
router.get('/states', auth, (req, res) => proxy('/states?' + new URLSearchParams(req.query).toString(), res));
router.get('/explain', auth, (req, res) => proxy('/explain?' + new URLSearchParams(req.query).toString(), res));

// Savings simulator: farmer's net via KisanConnect (direct) vs the usual mandi route.
// Mandi-route price = the AI fair (modal) price; middleman cut & transport are EDITABLE ASSUMPTIONS, not measured facts.
router.get('/savings', auth, async (req, res) => {
  const crop = String(req.query.crop || '').trim();
  const qty = Number(req.query.qty), rate = Number(req.query.rate);
  const cut = Math.min(30, Math.max(0, Number(req.query.cut ?? 6)));            // % commission + mandi charges
  const transport = Math.min(500, Math.max(0, Number(req.query.transport ?? 30))); // Rs per quintal to reach the mandi
  if (!crop || !(qty > 0) || !(rate > 0)) return res.status(400).json({ error: 'Enter crop, quantity and your direct rate.' });
  try {
    const r = await fetch(ML + '/fair-price?commodity=' + encodeURIComponent(crop));
    const fp = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: fp.detail || 'No mandi data for this crop.' });
    // prefer today's official national price (Agmarknet report) as the mandi benchmark; fall back to the AI fair price
    const nat = fp.national_today && fp.national_today.price;
    const mandiRate = nat || fp.fair_price;
    const mandiNet = qty * (mandiRate * (1 - cut / 100) - transport);
    const directNet = qty * rate;
    res.json({ crop: fp.commodity, qty, directRate: rate, mandiRate, mandiSource: nat ? 'Agmarknet national price, ' + fp.national_today.date : 'AI fair price (May-2025 mandi snapshot)', cutPct: cut, transportPerQ: transport,
      mandiNet: Math.round(mandiNet), directNet: Math.round(directNet), extra: Math.round(directNet - mandiNet),
      extraPct: mandiNet > 0 ? Math.round(((directNet - mandiNet) / mandiNet) * 1000) / 10 : null,
      assumption: 'Mandi benchmark = official national price when available (else AI fair price); cut and transport are adjustable assumptions.' });
  } catch (e) { res.status(503).json({ error: 'AI/ML service is not running.' }); }
});

module.exports = router;
