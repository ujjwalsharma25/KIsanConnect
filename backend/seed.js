/*
 Optional demo-data seeder so the dashboards aren't empty when judges open the app.
 Creates a few demo farmer/buyer accounts, real-crop listings, and a couple of orders
 (one released so Sales/Purchase history + ratings have something to show).

 Run:  node seed.js
 (all demo accounts use password: demo1234)
*/
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Listing = require('./models/Listing');
const Order = require('./models/Order');

const FARMERS = [
  { name: 'Ramesh Kisan', phone: '9000000001', location: 'Meerut, UP' },
  { name: 'Suresh Yadav', phone: '9000000002', location: 'Ghaziabad, UP' },
];
const BUYERS = [
  { name: 'Anita Traders', phone: '9000000011', location: 'Noida, UP', buyerType: 'wholesale' },
  { name: 'Green Grocers', phone: '9000000012', location: 'Delhi', buyerType: 'retail' },
];
const CROPS = [
  { crop: 'Onion', quantityQuintal: 60, rate: 1350, grade: 'A' },
  { crop: 'Potato', quantityQuintal: 80, rate: 950, grade: 'A' },
  { crop: 'Tomato', quantityQuintal: 40, rate: 1450, grade: 'B', organic: true },
  { crop: 'Wheat', quantityQuintal: 100, rate: 2450, grade: 'A' },
];

async function upsertUser(u, role) {
  const hash = await bcrypt.hash('demo1234', 10), rhash = await bcrypt.hash('1234', 10);
  return User.findOneAndUpdate({ phone: u.phone }, { ...u, role, password: hash, recoveryHash: rhash }, { upsert: true, new: true });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Seeding demo data...');

  const farmers = [];
  for (const f of FARMERS) farmers.push(await upsertUser(f, 'farmer'));
  const buyers = [];
  for (const b of BUYERS) buyers.push(await upsertUser(b, 'buyer'));

  const listings = [];
  for (let i = 0; i < CROPS.length; i++) {
    const c = CROPS[i], f = farmers[i % farmers.length];
    const existing = await Listing.findOne({ crop: c.crop, farmer: f._id });
    const { SHELF_LIFE } = require('./config');
    const ageDays = c.crop === 'Tomato' ? 5 : 1;   // demo: tomatoes are close to spoiling -> shows the freshness countdown + urgent badge
    const l = existing || await Listing.create({
      ...c, harvestDate: new Date(Date.now() - ageDays * 864e5), shelfLifeDays: SHELF_LIFE[c.crop.toLowerCase()] || SHELF_LIFE.default, location: f.location, route: `Every Sunday, ${f.location.split(',')[0]}`,
      farmer: f._id, farmerName: f.name, farmerPhone: f.phone
    });
    listings.push(l);
  }

  // one completed order with a rating, one still in escrow
  const l0 = listings[0], b0 = buyers[0];
  const already = await Order.findOne({ listing: l0._id, buyer: b0._id });
  if (!already) {
    const subtotal = 10 * l0.rate, fee = Math.round(subtotal * 0.02), deliveryFee = 10 * 40;
    await Order.create({
      listing: l0._id, crop: l0.crop, qty: 10, rate: l0.rate, subtotal, fee, mode: 'truck', deliveryFee,
      total: subtotal + fee + deliveryFee, buyer: b0._id, buyerName: b0.name, buyerPhone: b0.phone,
      farmer: l0.farmer, farmerName: l0.farmerName, farmerPhone: l0.farmerPhone,
      status: 'released', rating: 5, review: 'Fresh onions, on time delivery.',
      shippedAt: new Date(Date.now() - 36e5 * 30), releasedAt: new Date(),
      events: [{ status: 'escrow', at: new Date(Date.now() - 36e5 * 50), note: 'Payment held in escrow' }, { status: 'shipped', at: new Date(Date.now() - 36e5 * 30), note: 'Farmer shipped the lot' }, { status: 'released', at: new Date(), note: 'Buyer confirmed delivery' }]
    });
  }
  const l1 = listings[1], b1 = buyers[1];
  const already2 = await Order.findOne({ listing: l1._id, buyer: b1._id });
  if (!already2) {
    const subtotal = 15 * l1.rate, fee = Math.round(subtotal * 0.02), deliveryFee = 15 * 15;
    await Order.create({
      listing: l1._id, crop: l1.crop, qty: 15, rate: l1.rate, subtotal, fee, mode: 'society', deliveryFee,
      total: subtotal + fee + deliveryFee, buyer: b1._id, buyerName: b1.name, buyerPhone: b1.phone,
      farmer: l1.farmer, farmerName: l1.farmerName, farmerPhone: l1.farmerPhone, status: 'escrow',
      events: [{ status: 'escrow', at: new Date(), note: 'Payment held in escrow' }]
    });
  }
  // demo of the dispute flow: a disputed order the farmer can accept (refund) — shows escrow is not just a status label
  const l2 = listings[2], b2 = buyers[0];
  if (l2 && !(await Order.findOne({ listing: l2._id, buyer: b2._id }))) {
    const subtotal = 5 * l2.rate, fee = Math.round(subtotal * 0.02), deliveryFee = 5 * 10;
    await Order.create({
      listing: l2._id, crop: l2.crop, qty: 5, rate: l2.rate, subtotal, fee, mode: 'hub', deliveryFee, total: subtotal + fee + deliveryFee,
      buyer: b2._id, buyerName: b2.name, buyerPhone: b2.phone, farmer: l2.farmer, farmerName: l2.farmerName, farmerPhone: l2.farmerPhone,
      status: 'disputed', disputeReason: 'A few crates arrived damaged', disputedAt: new Date(), shippedAt: new Date(Date.now() - 36e5 * 4),
      events: [{ status: 'escrow', at: new Date(Date.now() - 36e5 * 10), note: 'Payment held in escrow' }, { status: 'shipped', at: new Date(Date.now() - 36e5 * 4), note: 'Farmer shipped the lot' }, { status: 'disputed', at: new Date(), note: 'A few crates arrived damaged' }]
    });
  }

  console.log(`Seeded ${farmers.length} farmers, ${buyers.length} buyers, ${listings.length} listings, 3 orders (released / escrow / disputed).`);
  console.log('Login with any of these phones + password "demo1234" (recovery PIN for "Forgot password": 1234):');
  [...FARMERS, ...BUYERS].forEach(u => console.log(' -', u.phone, u.name));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
