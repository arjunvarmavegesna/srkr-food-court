'use strict';

const express = require('express');
const router = express.Router();
const { getAllOrders } = require('../services/orderStore');

// ── Lazy Firestore init — avoids "called before app init" error ───────────────
function getMenuDoc() {
  const admin = require('firebase-admin');
  return admin.firestore().collection('config').doc('menu');
}

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
    const doc = await getMenuDoc().get();
    const menu = doc.exists ? doc.data().items : [];
    res.json(menu);
  } catch (err) {
    console.error('❌ GET /admin/menu error:', err.message);
    res.status(500).json({ error: 'Could not read menu: ' + err.message });
  }
});

// PUT /admin/menu — replace entire menu
router.put('/menu', authCheck, async (req, res) => {
  try {
    const menu = req.body;
    if (!Array.isArray(menu)) return res.status(400).json({ error: 'Body must be an array' });
    menu.forEach((item, i) => { item.id = i + 1; });
    await getMenuDoc().set({ items: menu });
    console.log(`✅ Menu saved to Firestore: ${menu.length} items`);
    res.json({ success: true, count: menu.length });
  } catch (err) {
    console.error('❌ PUT /admin/menu error:', err.message);
    res.status(500).json({ error: 'Could not write menu: ' + err.message });
  }
});

// POST /admin/menu — add single item
router.post('/menu', authCheck, async (req, res) => {
  try {
    const MENU_DOC = getMenuDoc();
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
    console.log(`✅ Item added to Firestore: ${newItem.name}`);
    res.json({ success: true, item: newItem });
  } catch (err) {
    console.error('❌ POST /admin/menu error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/menu/:id — update single item
router.patch('/menu/:id', authCheck, async (req, res) => {
  try {
    const MENU_DOC = getMenuDoc();
    const doc = await MENU_DOC.get();
    const menu = doc.exists ? doc.data().items : [];
    const idx = menu.findIndex(i => i.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Item not found' });
    menu[idx] = { ...menu[idx], ...req.body, id: menu[idx].id };
    if (req.body.price) menu[idx].price = Number(req.body.price);
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, item: menu[idx] });
  } catch (err) {
    console.error('❌ PATCH /admin/menu error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /admin/menu/:id
router.delete('/menu/:id', authCheck, async (req, res) => {
  try {
    const MENU_DOC = getMenuDoc();
    const doc = await MENU_DOC.get();
    let menu = doc.exists ? doc.data().items : [];
    const before = menu.length;
    menu = menu.filter(i => i.id !== Number(req.params.id));
    if (menu.length === before) return res.status(404).json({ error: 'Item not found' });
    menu.forEach((item, i) => { item.id = i + 1; });
    await MENU_DOC.set({ items: menu });
    res.json({ success: true, remaining: menu.length });
  } catch (err) {
    console.error('❌ DELETE /admin/menu error:', err.message);
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
    console.error('❌ GET /admin/orders error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
