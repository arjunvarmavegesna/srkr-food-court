'use strict';

require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  restaurant: {
    name: process.env.RESTAURANT_NAME || 'Deekshita Food Court',
    phone: process.env.RESTAURANT_PHONE || '',
  },
};

// Validate critical env vars on startup
const required = [
  ['TWILIO_ACCOUNT_SID', config.twilio.accountSid],
  ['TWILIO_AUTH_TOKEN', config.twilio.authToken],
  ['RAZORPAY_KEY_ID', config.razorpay.keyId],
  ['RAZORPAY_KEY_SECRET', config.razorpay.keySecret],
  ['RAZORPAY_WEBHOOK_SECRET', config.razorpay.webhookSecret],
  ['BASE_URL', config.baseUrl !== 'http://localhost:3000' ? config.baseUrl : null],
];

const missing = required.filter(([, val]) => !val).map(([key]) => key);
if (missing.length > 0) {
  console.warn(`⚠️  Missing env vars: ${missing.join(', ')}. Some features may not work.`);
}

module.exports = config;
