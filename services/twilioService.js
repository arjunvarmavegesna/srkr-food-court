'use strict';

const twilio = require('twilio');
const config = require('../config');

let client;

function getClient() {
  if (!client) {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      throw new Error('Twilio credentials are not configured.');
    }
    client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return client;
}

/**
 * Send a WhatsApp message via Twilio.
 * @param {string} to   - Recipient in E.164, e.g. +919876543210
 * @param {string} body - Message text (WhatsApp markdown supported)
 * @returns {Promise<object>}
 */
async function sendMessage(to, body) {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  const message = await getClient().messages.create({
    from: config.twilio.whatsappNumber,
    to: toFormatted,
    body,
  });

  console.log(`📤 Message sent to ${to} | SID: ${message.sid}`);
  return message;
}

module.exports = { sendMessage };
