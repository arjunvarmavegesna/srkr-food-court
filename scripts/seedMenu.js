'use strict';

/**
 * Run once to upload your menu.json into Firestore.
 *
 *   node scripts/seedMenu.js
 *
 * After this, manage your menu from the admin panel — no need to run again
 * unless you want to fully reset the menu.
 */

require('dotenv').config();

const db   = require('../config/firebase');
const menu = require('../menu.json');

async function seed() {
  console.log(`🌱 Seeding ${menu.length} items to Firestore...`);
  await db.collection('config').doc('menu').set({ items: menu });
  console.log(`✅ Menu seeded successfully! ${menu.length} items saved.`);
  console.log(`\nItems uploaded:`);
  menu.forEach(item => console.log(`  ${item.id}. ${item.name} (${item.type}) – ₹${item.price}`));
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
