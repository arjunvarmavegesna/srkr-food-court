'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/orders.json');
const dataDir   = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch { console.warn('⚠️  Could not read orders.json – starting fresh.'); }
  return [];
}

function saveOrders(orders) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf8'); }
  catch (err) { console.error('❌ Failed to persist orders:', err.message); }
}

const sessions = {};
let orders = loadOrders();

// ── Sessions ──────────────────────────────────────────────────────────────────
// cart: [ { id, name, category, type, price, qty } ]

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      step: 'WELCOME',
      selectedCategory: null,
      cart: [],
      orderId: null,
    };
  }
  return sessions[phone];
}

function setSession(phone, data) {
  sessions[phone] = { ...getSession(phone), ...data };
}

function resetSession(phone) {
  sessions[phone] = {
    step: 'WELCOME',
    selectedCategory: null,
    cart: [],
    orderId: null,
  };
}

// ── Cart helpers ──────────────────────────────────────────────────────────────

function addToCart(phone, item) {
  const session = getSession(phone);
  const cart    = session.cart || [];
  const existing = cart.find(c => c.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  setSession(phone, { cart });
  return cart;
}

function removeFromCart(phone, itemId) {
  const session = getSession(phone);
  const cart    = (session.cart || []).filter(c => c.id !== itemId);
  setSession(phone, { cart });
  return cart;
}

function clearCart(phone) {
  setSession(phone, { cart: [] });
}

function getCart(phone) {
  return getSession(phone).cart || [];
}

function getCartTotal(phone) {
  return getCart(phone).reduce((sum, c) => sum + c.price * c.qty, 0);
}

// ── Orders ────────────────────────────────────────────────────────────────────

function createOrder({ phone, cart, paymentLinkId, paymentLinkUrl }) {
  const { v4: uuidv4 } = require('uuid');
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const order = {
    id: uuidv4(),
    phone,
    items: cart.map(c => ({
      id: c.id, name: c.name, category: c.category,
      type: c.type, price: c.price, qty: c.qty,
    })),
    total,
    paymentLinkId,
    paymentLinkUrl,
    paymentStatus: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.push(order);
  saveOrders(orders);
  console.log(`📝 Order created: ${order.id} | total: ₹${total} | items: ${cart.length}`);
  return order;
}

function getOrderByPaymentLinkId(paymentLinkId) {
  const found = orders.find(o => o.paymentLinkId === paymentLinkId) || null;
  console.log(`🔍 Lookup paymentLinkId=${paymentLinkId} → ${found ? 'FOUND' : 'NOT FOUND'}`);
  return found;
}

function getLatestOrderByPhone(phone) {
  const phoneOrders = orders.filter(o => o.phone === phone);
  if (!phoneOrders.length) return null;
  return phoneOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
}

function updateOrderPaymentStatus(paymentLinkId, status) {
  const idx = orders.findIndex(o => o.paymentLinkId === paymentLinkId);
  if (idx === -1) { console.warn(`⚠️  updateStatus: no order for ${paymentLinkId}`); return null; }
  orders[idx].paymentStatus = status;
  orders[idx].updatedAt = new Date().toISOString();
  saveOrders(orders);
  console.log(`💾 Order ${orders[idx].id} status → ${status}`);
  return orders[idx];
}

function getAllOrders() { return orders; }

module.exports = {
  getSession, setSession, resetSession,
  addToCart, removeFromCart, clearCart, getCart, getCartTotal,
  createOrder, getOrderByPaymentLinkId,
  getLatestOrderByPhone, updateOrderPaymentStatus, getAllOrders,
};