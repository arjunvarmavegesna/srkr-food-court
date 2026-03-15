'use strict';

// Firebase is initialised in config/firebase.js — import db from there
const db      = require('../config/firebase');
const MENU_DOC = db.collection('config').doc('menu');

const CATEGORY_EMOJI = {
  'Fried Rice' : '🍚',
  'Noodles'    : '🍜',
  'Sandwich'   : '🥪',
  'Maggies'    : '🍝',
  'Frankie'    : '🌯',
  'Juices'     : '🧃',
  'Snacks'     : '🍟',
  'Milkshakes' : '🥤',
  'Burgers'    : '🍔',
  'Mocktails'  : '🍹',
};

function getCategoryEmoji(cat) {
  return CATEGORY_EMOJI[cat] || '🍽️';
}

// ── 30-second in-memory cache — avoids Firestore read on every WhatsApp msg ──

let _menuCache    = null;
let _menuCacheTime = 0;
const CACHE_TTL   = 30 * 1000;

async function getMenu() {
  const now = Date.now();
  if (_menuCache && (now - _menuCacheTime) < CACHE_TTL) return _menuCache;
  try {
    const doc  = await MENU_DOC.get();
    _menuCache     = doc.exists ? doc.data().items : [];
    _menuCacheTime = now;
    return _menuCache;
  } catch (err) {
    console.error('❌ menuService: failed to load menu from Firestore:', err.message);
    return _menuCache || [];   // return stale cache if Firestore is temporarily down
  }
}

// Call this after any admin panel update so the bot sees changes immediately
function invalidateMenuCache() {
  _menuCache     = null;
  _menuCacheTime = 0;
}

// ── All helpers are async (await getMenu internally) ─────────────────────────

async function getCategories() {
  const menu = await getMenu();
  const seen = new Set();
  return menu
    .filter(i => { if (seen.has(i.category)) return false; seen.add(i.category); return true; })
    .map(i => i.category);
}

async function getItemsByCategory(category) {
  const menu = await getMenu();
  return menu.filter(i => i.category === category);
}

async function getItemByNumber(number) {
  const menu = await getMenu();
  const idx  = parseInt(number, 10);
  if (isNaN(idx) || idx < 1 || idx > menu.length) return null;
  return menu[idx - 1];
}

async function getItemByCategoryAndNumber(category, number) {
  const items = await getItemsByCategory(category);
  const idx   = parseInt(number, 10);
  if (isNaN(idx) || idx < 1 || idx > items.length) return null;
  return items[idx - 1];
}

async function formatCategoryMessage() {
  const cats = await getCategories();
  const menu = await getMenu();
  const lines = ['🍽️ *Welcome! Choose a Category:*\n'];
  cats.forEach((cat, i) => {
    const count = menu.filter(m => m.category === cat).length;
    lines.push(`${i + 1}. ${getCategoryEmoji(cat)} *${cat}*  _(${count} items)_`);
  });
  lines.push('\n_Reply with the category number_');
  return lines.join('\n');
}

async function formatCategoryItemsMessage(category) {
  const items = await getItemsByCategory(category);
  if (!items.length) return null;
  const lines = [`${getCategoryEmoji(category)} *${category}*\n`];
  items.forEach((item, i) => {
    const typeEmoji = item.type === 'Veg' ? '🥦' : '🍗';
    lines.push(`${i + 1}. ${typeEmoji} ${item.name} – ₹${item.price}`);
  });
  lines.push('\n_Reply with the item number to order_');
  lines.push('_Type *BACK* to go back to categories_');
  return lines.join('\n');
}

async function formatMenuMessage() {
  const cats  = await getCategories();
  const lines = ['📋 *Our Full Menu:*\n'];
  for (const cat of cats) {
    lines.push(`\n${getCategoryEmoji(cat)} *${cat}*`);
    const items = await getItemsByCategory(cat);
    items.forEach(item => {
      lines.push(`  ${item.type === 'Veg' ? '🥦' : '🍗'} ${item.name} – ₹${item.price}`);
    });
  }
  return lines.join('\n');
}

module.exports = {
  getMenu, getCategories, getItemsByCategory,
  getItemByNumber, getItemByCategoryAndNumber,
  formatCategoryMessage, formatCategoryItemsMessage, formatMenuMessage,
  invalidateMenuCache,
};
