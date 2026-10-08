const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();
const PIN_RE = /^\d{4,6}$/;
const sign = (u) => jwt.sign({ userId: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
const pub = (u) => ({ id: u._id, name: u.name, phone: u.phone, role: u.role, location: u.location, buyerType: u.buyerType, hasRecovery: !!u.recoveryHash });
// every error carries a `code` so the UI can show it in the user's language (Hindi OR English)
const fail = (res, status, code, error) => res.status(status).json({ code, error });

// tiny in-memory throttle: max `n` failed attempts per key per window (protects login from guessing)
const hits = new Map();
function throttled(key, n = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now(), h = (hits.get(key) || []).filter((t) => now - t < windowMs);
  hits.set(key, h);
  return h.length >= n;
}
const noteFail = (key) => { const h = hits.get(key) || []; h.push(Date.now()); hits.set(key, h); };

// ---- SIGNUP ----
router.post('/signup',
  [
    body('name').trim().notEmpty(),
    body('phone').trim().isLength({ min: 10 }),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['farmer', 'buyer']),
    body('recoveryPin').matches(PIN_RE),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const f = errors.array()[0].path;
      return fail(res, 400, f === 'recoveryPin' ? 'BAD_PIN_FORMAT' : f === 'password' ? 'SHORT_PASSWORD' : f === 'phone' ? 'BAD_PHONE' : 'FILL_ALL', errors.array()[0].msg);
    }
    const { name, phone, password, role, location, buyerType, recoveryPin } = req.body;
    try {
      if (await User.findOne({ phone })) return fail(res, 400, 'PHONE_TAKEN', 'This phone number is already registered.');
      const user = await User.create({
        name, phone, password: await bcrypt.hash(password, 10), recoveryHash: await bcrypt.hash(recoveryPin, 10), role,
        location: location || '', buyerType: role === 'buyer' ? (buyerType || 'retail') : ''
      });
      res.status(201).json({ token: sign(user), user: pub(user) });
    } catch (err) { fail(res, 500, 'SERVER', 'Signup failed. Please try again.'); }
  }
);

// ---- LOGIN ----
router.post('/login',
  [body('phone').trim().notEmpty(), body('password').notEmpty()],
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return fail(res, 400, 'FILL_ALL', 'Phone and password required');
    const { phone, password } = req.body;
    const key = 'login:' + phone;
    if (throttled(key)) return fail(res, 429, 'TOO_MANY', 'Too many attempts. Try again in 10 minutes.');
    try {
      const user = await User.findOne({ phone });
      if (!user) { noteFail(key); return fail(res, 400, 'NO_ACCOUNT', 'No account found with this phone number.'); }
      if (!(await bcrypt.compare(password, user.password))) { noteFail(key); return fail(res, 400, 'BAD_PASSWORD', 'Incorrect password.'); }
      res.json({ token: sign(user), user: pub(user) });
    } catch (err) { fail(res, 500, 'SERVER', 'Login failed. Please try again.'); }
  }
);

// ---- FORGOT PASSWORD: phone + recovery PIN (set at signup) -> new password. No SMS/e-mail provider needed (free-tier friendly).
router.post('/forgot',
  [body('phone').trim().notEmpty(), body('pin').matches(PIN_RE), body('newPassword').isLength({ min: 6 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return fail(res, 400, errors.array()[0].path === 'newPassword' ? 'SHORT_PASSWORD' : 'BAD_RESET', 'Check the details and try again.');
    const { phone, pin, newPassword } = req.body;
    try {
      const user = await User.findOne({ phone });
      // one generic answer for "no such user / no PIN / wrong PIN" so the form cannot be used to discover accounts
      if (!user || !user.recoveryHash) return fail(res, 400, 'BAD_RESET', 'Phone or recovery PIN is incorrect.');
      if (user.recoveryLockUntil && user.recoveryLockUntil > new Date()) return fail(res, 429, 'LOCKED', 'Too many wrong attempts. Try again in 15 minutes.');
      if (!(await bcrypt.compare(pin, user.recoveryHash))) {
        user.recoveryFails = (user.recoveryFails || 0) + 1;
        if (user.recoveryFails >= 5) { user.recoveryLockUntil = new Date(Date.now() + 15 * 60000); user.recoveryFails = 0; }
        await user.save();
        return fail(res, 400, 'BAD_RESET', 'Phone or recovery PIN is incorrect.');
      }
      user.password = await bcrypt.hash(newPassword, 10); user.recoveryFails = 0; user.recoveryLockUntil = undefined;
      await user.save();
      res.json({ ok: true });
    } catch (e) { fail(res, 500, 'SERVER', 'Could not reset password.'); }
  }
);

// ---- logged-in account security ----
router.post('/change-password', auth, [body('oldPassword').notEmpty(), body('newPassword').isLength({ min: 6 })], async (req, res) => {
  if (!validationResult(req).isEmpty()) return fail(res, 400, 'SHORT_PASSWORD', 'New password must be at least 6 characters.');
  try {
    const user = await User.findById(req.userId);
    if (!user || !(await bcrypt.compare(req.body.oldPassword, user.password))) return fail(res, 400, 'BAD_PASSWORD', 'Incorrect password.');
    user.password = await bcrypt.hash(req.body.newPassword, 10); await user.save(); res.json({ ok: true });
  } catch (e) { fail(res, 500, 'SERVER', 'Could not change password.'); }
});

router.post('/recovery', auth, [body('password').notEmpty(), body('pin').matches(PIN_RE)], async (req, res) => {
  if (!validationResult(req).isEmpty()) return fail(res, 400, 'BAD_PIN_FORMAT', 'PIN must be 4-6 digits.');
  try {
    const user = await User.findById(req.userId);
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) return fail(res, 400, 'BAD_PASSWORD', 'Incorrect password.');
    user.recoveryHash = await bcrypt.hash(req.body.pin, 10); user.recoveryFails = 0; user.recoveryLockUntil = undefined; await user.save();
    res.json({ ok: true });
  } catch (e) { fail(res, 500, 'SERVER', 'Could not save recovery PIN.'); }
});

module.exports = router;
