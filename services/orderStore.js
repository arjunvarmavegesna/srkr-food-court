'use strict';

// Firebase is initialised in config/firebase.js — import db from there
const db = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

// ── In-memory sessions ────────────────────────────────────────────────────────
// Sessions are short-lived (one conversation) so in-memory is fine.
// If you ever run multiple Railway replicas, move these to Firestore too.

const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = { step: 'WELCOME', selectedCategory: null, cart: [], orderId: null };
  }
  return sessions[phone];
}

function setSession(phone, data) {
  sessions[phone] = { ...getSession(phone), ...data };
}

function resetSession(phone) {
  sessions[phone] = { step: 'WELCOME', selectedCategory: null, cart: [], orderId: null };
}

// ── Cart helpers (in-memory) ──────────────────────────────────────────────────

function addToCart(phone, item) {
  const session  = getSession(phone);
  const cart     = session.cart || [];
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

// ── Orders — Firestore ────────────────────────────────────────────────────────

async function createOrder({ phone, cart, paymentLinkId, paymentLinkUrl }) {
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const order = {
    id: uuidv4(),
    phone,
    items: cart.map(c => ({
      id: c.id, name: c.name, category: c.category || '',
      type: c.type, price: c.price, qty: c.qty,
    })),
    total,
    paymentLinkId,
    paymentLinkUrl,
    paymentStatus: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.collection('orders').doc(order.id).set(order);
  console.log(`📝 Order created: ${order.id} | total: ₹${total} | items: ${cart.length}`);
  return order;
}

async function getOrderByPaymentLinkId(paymentLinkId) {
  const snap = await db.collection('orders')
    .where('paymentLinkId', '==', paymentLinkId)
    .limit(1)
    .get();
  if (snap.empty) {
    console.warn(`⚠️  No order found for paymentLinkId=${paymentLinkId}`);
    return null;
  }
  console.log(`🔍 Lookup paymentLinkId=${paymentLinkId} → FOUND`);
  return snap.docs[0].data();
}

async function getLatestOrderByPhone(phone) {
  const snap = await db.collection('orders')
    .where('phone', '==', phone)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data();
}

async function updateOrderPaymentStatus(paymentLinkId, status) {
  const snap = await db.collection('orders')
    .where('paymentLinkId', '==', paymentLinkId)
    .limit(1)
    .get();
  if (snap.empty) {
    console.warn(`⚠️  updateStatus: no order for ${paymentLinkId}`);
    return null;
  }
  const doc     = snap.docs[0];
  const updated = { paymentStatus: status, updatedAt: new Date().toISOString() };
  await doc.ref.update(updated);
  console.log(`💾 Order ${doc.id} status → ${status}`);
  return { ...doc.data(), ...updated };
}

async function getAllOrders() {
  const snap = await db.collection('orders')
    .orderBy('createdAt', 'desc')
    .get();
  return snap.docs.map(d => d.data());
}

module.exports = {
  // Session (sync)
  getSession, setSession, resetSession,
  // Cart (sync)
  addToCart, removeFromCart, clearCart, getCart, getCartTotal,
  // Orders (async)
  createOrder, getOrderByPaymentLinkId,
  getLatestOrderByPhone, updateOrderPaymentStatus, getAllOrders,
};
