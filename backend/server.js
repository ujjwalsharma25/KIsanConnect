require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/market', require('./routes/market'));
app.use('/api/stats', require('./routes/stats'));
app.get('/api/health', (req, res) => res.json({ status: 'KisanConnect API is running' }));

// In production, serve the built React app (frontend/dist).
// In development, run the React dev server separately (frontend: npm run dev, port 5173)
// which proxies /api and /uploads to this server — see frontend/vite.config.js.
const reactDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(reactDist)) {
  app.use(express.static(reactDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(reactDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error('Missing MONGO_URI or JWT_SECRET. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`KisanConnect running at http://localhost:${PORT}`));
    // Keep the free-tier ML service warm while this backend is awake (pings its /health every 10 min).
    const ML = process.env.ML_SERVICE_URL;
    if (ML && !/localhost|127\.0\.0\.1/.test(ML)) {
      const ping = () => fetch(ML + '/health').catch(() => {});
      ping(); setInterval(ping, 10 * 60 * 1000);
    }
    // Keep THIS service (and, through /warm, the ML service) awake during a daily window (IST), automatically on Render.
    // KEEP_ALIVE=false turns it off; KEEP_ALIVE_HOURS="9-21" is the window (use "0-24" for judging day). Free instance-hours are limited.
    const ka = (process.env.KEEP_ALIVE || 'auto').toLowerCase();
    if (ka !== 'false' && process.env.RENDER_EXTERNAL_URL) {
      const [from, to] = (process.env.KEEP_ALIVE_HOURS || '9-21').split('-').map(Number);
      const inWindow = () => { const h = new Date(Date.now() + 5.5 * 3600e3).getUTCHours(); return (from === 0 && to === 24) || (h >= from && h < to); };
      setInterval(() => { if (inWindow()) fetch(process.env.RENDER_EXTERNAL_URL + '/api/market/warm').catch(() => {}); }, 8 * 60 * 1000);
      console.log(`Keep-alive on (${from}:00-${to}:00 IST)`);
    }
  })
  .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
