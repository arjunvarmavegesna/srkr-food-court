'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getAllOrders } = require('../services/orderStore');

const MENU_FILE = path.join(__dirname, '../menu.json');

function authCheck(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (process.env.ADMIN_API_KEY && apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Serve admin panel HTML
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// GET /admin/menu
router.get('/menu', authCheck, (req, res) => {
  try {
    const menu = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Could not read menu.json' });
  }
});

// PUT /admin/menu — replace entire menu (used by admin panel)
router.put('/menu', authCheck, (req, res) => {
  try {
    const menu = req.body;
    if (!Array.isArray(menu)) return res.status(400).json({ error: 'Body must be an array' });
    menu.forEach((item, i) => { item.id = i + 1; });
    fs.writeFileSync(MENU_FILE, JSON.stringify(menu, null, 2), 'utf8');
    delete require.cache[require.resolve('../menu.json')];
    res.json({ success: true, count: menu.length });
  } catch (err) {
    res.status(500).json({ error: 'Could not write menu.json: ' + err.message });
  }
});

// POST /admin/menu — add single item
router.post('/menu', authCheck, (req, res) => {
  try {
    const menu = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
    const { name, type, price, description } = req.body;
    if (!name || !type || !price) return res.status(400).json({ error: 'name, type, price required' });
    const newItem = {
      id: menu.length ? Math.max(...menu.map(i => i.id)) + 1 : 1,
      name, type,
      price: Number(price),
      description: description || '',
    };
    menu.push(newItem);
    fs.writeFileSync(MENU_FILE, JSON.stringify(menu, null, 2), 'utf8');
    delete require.cache[require.resolve('../menu.json')];
    res.json({ success: true, item: newItem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/menu/:id — update single item
router.patch('/menu/:id', authCheck, (req, res) => {
  try {
    const menu = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
    const idx = menu.findIndex(i => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    menu[idx] = { ...menu[idx], ...req.body, id: menu[idx].id };
    if (req.body.price) menu[idx].price = Number(req.body.price);
    fs.writeFileSync(MENU_FILE, JSON.stringify(menu, null, 2), 'utf8');
    delete require.cache[require.resolve('../menu.json')];
    res.json({ success: true, item: menu[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/menu/:id
router.delete('/menu/:id', authCheck, (req, res) => {
  try {
    let menu = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
    const before = menu.length;
    menu = menu.filter(i => i.id !== Number(req.params.id));
    if (menu.length === before) return res.status(404).json({ error: 'Item not found' });
    menu.forEach((item, i) => { item.id = i + 1; });
    fs.writeFileSync(MENU_FILE, JSON.stringify(menu, null, 2), 'utf8');
    delete require.cache[require.resolve('../menu.json')];
    res.json({ success: true, remaining: menu.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/orders
router.get('/orders', authCheck, (req, res) => {
  const orders = getAllOrders();
  res.json({
    total: orders.length,
    paid: orders.filter(o => o.paymentStatus === 'PAID').length,
    pending: orders.filter(o => o.paymentStatus === 'PENDING').length,
    failed: orders.filter(o => o.paymentStatus === 'FAILED').length,
    orders,
  });
});

module.exports = router;