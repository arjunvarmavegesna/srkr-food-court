'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');

const botRoutes = require('./routes/botRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('combined'));

// NOTE: The /payment/webhook route uses its OWN raw-body middleware (see route file).
// All other routes use standard JSON + urlencoded parsers.
app.use((req, res, next) => {
  if (req.path === '/payment/webhook') return next();
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === '/payment/webhook') return next();
  express.urlencoded({ extended: false })(req, res, next);
});

// ── Static files (admin panel) ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: `${config.restaurant.name} – WhatsApp Food Bot`,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhook', botRoutes);
app.use('/payment', paymentRoutes);
app.use('/admin', adminRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = config.port;
app.listen(PORT, () => {
  console.log('');
  console.log(`🍽️  ================================================`);
  console.log(`    ${config.restaurant.name}`);
  console.log(`    WhatsApp Food Ordering Bot`);
  console.log(`🍽️  ================================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint : POST /webhook`);
  console.log(`💳 Payment webhook  : POST /payment/webhook`);
  console.log(`🎛️  Admin panel      : http://localhost:${PORT}/admin`);
  console.log(`📋 Admin orders     : GET  /admin/orders`);
  console.log(`🌐 Base URL         : ${config.baseUrl}`);
  console.log('');
});

module.exports = app;