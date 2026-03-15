'use strict';

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getAllOrders } = require('../services/orderStore');

const db = admin.firestore();
const MENU_DOC = db.collection('config').doc('menu');

function authCheck(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (process.env.ADMIN_API_KEY && apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Serve admin panel HTML
router.get('/', (req, res) => {
  const path = require('path');
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// GET /admin/menu
router.get('/menu', authCheck, async (req, res) => {
  try {
    const doc = await MENU_DOC.get();
    const menu = doc.exists ? doc.data().items : [];
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Could not read menu: ' + err.message });
  }
});

// PUT /admin/menu — replace entire menu
router.put('/menu', authCheck, async (req, res) => {
  try {
    const menu = req.body;
    if (!Array.isArray(menu)) return res.status(400).json({ error: 'Body must be an array' });
    menu.forEach((item, i) => { item.id = i + 1; });
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, count: menu.length });
  } catch (err) {
    res.status(500).json({ error: 'Could not write menu: ' + err.message });
  }
});

// POST /admin/menu — add single item
router.post('/menu', authCheck, async (req, res) => {
  try {
    const doc = await MENU_DOC.get();
    const menu = doc.exists ? doc.data().items : [];
    const { name, type, price, category, description } = req.body;
    if (!name || !type || !price) return res.status(400).json({ error: 'name, type, price required' });
    const newItem = {
      id: menu.length ? Math.max(...menu.map(i => i.id)) + 1 : 1,
      name,
      type,
      category: category || '',
      price: Number(price),
      description: description || '',
    };
    menu.push(newItem);
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, item: newItem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/menu/:id — update single item
router.patch('/menu/:id', authCheck, async (req, res) => {
  try {
    const doc = await MENU_DOC.get();
    const menu = doc.exists ? doc.data().items : [];
    const idx = menu.findIndex(i => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    menu[idx] = { ...menu[idx], ...req.body, id: menu[idx].id };
    if (req.body.price) menu[idx].price = Number(req.body.price);
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, item: menu[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/menu/:id
router.delete('/menu/:id', authCheck, async (req, res) => {
  try {
    const doc = await MENU_DOC.get();
    let menu = doc.exists ? doc.data().items : [];
    const before = menu.length;
    menu = menu.filter(i => i.id !== Number(req.params.id));
    if (menu.length === before) return res.status(404).json({ error: 'Item not found' });
    menu.forEach((item, i) => { item.id = i + 1; });
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, remaining: menu.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/orders
router.get('/orders', authCheck, async (req, res) => {
  try {
    const orders = await getAllOrders();
    res.json({
      total: orders.length,
      paid: orders.filter(o => o.paymentStatus === 'PAID').length,
      pending: orders.filter(o => o.paymentStatus === 'PENDING').length,
      failed: orders.filter(o => o.paymentStatus === 'FAILED').length,
      orders,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
