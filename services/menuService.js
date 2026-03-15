'use strict';

const menu = require('../menu.json');

function getMenu() { return menu; }

// Category emojis map
const CATEGORY_EMOJI = {
  'Fried Rice'  : '🍚',
  'Noodles'     : '🍜',
  'Sandwich'    : '🥪',
  'Maggies'     : '🍝',
  'Frankie'     : '🌯',
  'Juices'      : '🧃',
  'Snacks'      : '🍟',
  'Milkshakes'  : '🥤',
  'Burgers'     : '🍔',
  'Mocktails'   : '🍹',
};

function getCategoryEmoji(cat) {
  return CATEGORY_EMOJI[cat] || '🍽️';
}

// Get unique categories in order they appear
function getCategories() {
  const seen = new Set();
  return menu.filter(i => {
    if (seen.has(i.category)) return false;
    seen.add(i.category);
    return true;
  }).map(i => i.category);
}

// Get items belonging to a category
function getItemsByCategory(category) {
  return menu.filter(i => i.category === category);
}

// Find item by its GLOBAL menu number
function getItemByNumber(number) {
  const idx = parseInt(number, 10);
  if (isNaN(idx) || idx < 1 || idx > menu.length) return null;
  return menu[idx - 1];
}

// Find item by position within a category (1-based)
function getItemByCategoryAndNumber(category, number) {
  const items = getItemsByCategory(category);
  const idx = parseInt(number, 10);
  if (isNaN(idx) || idx < 1 || idx > items.length) return null;
  return items[idx - 1];
}

// Format category list for WhatsApp
function formatCategoryMessage() {
  const cats = getCategories();
  const lines = ['🍽️ *Welcome! Choose a Category:*\n'];
  cats.forEach((cat, i) => {
    const items = getItemsByCategory(cat);
    const emoji = getCategoryEmoji(cat);
    lines.push(`${i + 1}. ${emoji} *${cat}*  _(${items.length} items)_`);
  });
  lines.push('\n_Reply with the category number_');
  return lines.join('\n');
}

// Format items within a category for WhatsApp
function formatCategoryItemsMessage(category) {
  const items = getItemsByCategory(category);
  if (!items.length) return null;
  const catEmoji = getCategoryEmoji(category);
  const lines = [`${catEmoji} *${category}*\n`];
  items.forEach((item, i) => {
    const typeEmoji = item.type === 'Veg' ? '🥦' : '🍗';
    lines.push(`${i + 1}. ${typeEmoji} ${item.name} – ₹${item.price}`);
  });
  lines.push('\n_Reply with the item number to order_');
  lines.push('_Type *BACK* to go back to categories_');
  return lines.join('\n');
}

// Full flat menu
function formatMenuMessage() {
  const cats = getCategories();
  const lines = ['📋 *Our Full Menu:*\n'];
  cats.forEach(cat => {
    const emoji = getCategoryEmoji(cat);
    lines.push(`\n${emoji} *${cat}*`);
    getItemsByCategory(cat).forEach(item => {
      const typeEmoji = item.type === 'Veg' ? '🥦' : '🍗';
      lines.push(`  ${typeEmoji} ${item.name} – ₹${item.price}`);
    });
  });
  return lines.join('\n');
}

module.exports = {
  getMenu, getCategories, getItemsByCategory,
  getItemByNumber, getItemByCategoryAndNumber,
  formatCategoryMessage, formatCategoryItemsMessage, formatMenuMessage,
};