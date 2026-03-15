'use strict';

const Razorpay = require('razorpay');
const crypto   = require('crypto');
const config   = require('../config');

let instance;

function getInstance() {
  if (!instance) {
    if (!config.razorpay.keyId || !config.razorpay.keySecret)
      throw new Error('Razorpay credentials are not configured.');
    instance = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  }
  return instance;
}

/**
 * Create a Razorpay Payment Link for a cart (multiple items).
 * @param {object} params
 * @param {string} params.orderId  - Internal order UUID
 * @param {string} params.phone    - whatsapp:+91xxxxxxxxxx
 * @param {Array}  params.cart     - [ { name, type, price, qty, category } ]
 * @param {number} params.total    - Total amount in ₹
 */
async function createPaymentLink({ orderId, phone, cart, total }) {
  const razorpay   = getInstance();
  const cleanPhone = phone.replace('whatsapp:', '').replace('+', '');

  // Build a short description listing items
  const itemSummary = cart
    .map(c => `${c.name}${c.qty > 1 ? ` x${c.qty}` : ''}`)
    .join(', ');

  const payload = {
    amount: total * 100, // paise
    currency: 'INR',
    accept_partial: false,
    description: `${config.restaurant.name}: ${itemSummary}`,
    customer: { contact: `+${cleanPhone}` },
    notify: { sms: false, email: false, whatsapp: false },
    reminder_enable: false,
    notes: {
      orderId,
      itemCount: String(cart.length),
      items: itemSummary.slice(0, 200),
      restaurantName: config.restaurant.name,
    },
    callback_url: `${config.baseUrl}/payment/success`,
    callback_method: 'get',
  };

  const link = await razorpay.paymentLink.create(payload);
  console.log(`💳 Payment link created: ${link.id} → ${link.short_url} | ₹${total}`);
  return { id: link.id, short_url: link.short_url };
}

function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

module.exports = { createPaymentLink, verifyWebhookSignature };