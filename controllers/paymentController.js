'use strict';

const { verifyWebhookSignature } = require('../services/razorpayService');
const { getOrderByPaymentLinkId, updateOrderPaymentStatus, resetSession, getAllOrders } = require('../services/orderStore');
const { sendMessage } = require('../services/twilioService');
const config = require('../config');

async function handleRazorpayWebhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;

  if (!rawBody) {
    console.warn('⚠️  Webhook: no body.');
    return res.status(400).json({ error: 'Missing body' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    console.warn('⚠️  Webhook: invalid JSON');
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const eventType = event.event;
  console.log(`\n🔔 ─── Razorpay event: ${eventType} ───`);

  // Signature check (optional for local dev)
  if (signature && process.env.RAZORPAY_WEBHOOK_SECRET) {
    try {
      const valid = verifyWebhookSignature(rawBody, signature);
      if (!valid) return res.status(400).json({ error: 'Invalid signature' });
    } catch (err) {
      return res.status(400).json({ error: 'Signature error' });
    }
  }

  // Acknowledge immediately
  res.status(200).json({ received: true });

  try {
    // ── PRIMARY: payment_link.paid (enable this in Razorpay dashboard) ────
    if (eventType === 'payment_link.paid') {
      const plId = event.payload?.payment_link?.entity?.id;
      console.log(`💳 payment_link.paid | plId: ${plId}`);
      if (plId) await sendPaymentConfirmation(plId, 'payment_link.paid');
      return;
    }

    // ── FALLBACK: payment.captured — extract payment_link_id from payment entity ──
    // This fires when Razorpay captures the payment, and always includes
    // the payment_link_id if the payment came from a payment link.
    if (eventType === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const plId = payment?.payment_link_id || payment?.invoice_id;
      console.log(`💰 payment.captured | payment_id: ${payment?.id} | payment_link_id: ${plId}`);
      if (plId) {
        await sendPaymentConfirmation(plId, 'payment.captured');
      } else {
        console.warn('⚠️  payment.captured has no payment_link_id — cannot match order');
        // Log all orders to debug
        console.log('📋 Current orders:', JSON.stringify(
          getAllOrders().map(o => ({ id: o.id, plId: o.paymentLinkId, status: o.paymentStatus }))
        ));
      }
      return;
    }

    // ── FALLBACK: order.paid — try to match via notes.orderId ─────────────
    if (eventType === 'order.paid') {
      const payment = event.payload?.payment?.entity;
      const plId = payment?.payment_link_id;
      console.log(`🧾 order.paid | payment_link_id: ${plId}`);
      if (plId) await sendPaymentConfirmation(plId, 'order.paid');
      return;
    }

    // ── payment.authorized: NOT the final state, wait for captured ────────
    if (eventType === 'payment.authorized') {
      console.log(`ℹ️  payment.authorized received — waiting for payment.captured to confirm.`);
      return;
    }

    // ── Failures ──────────────────────────────────────────────────────────
    if (eventType === 'payment_link.cancelled' || eventType === 'payment.failed') {
      const plEntity = event.payload?.payment_link?.entity;
      const payEntity = event.payload?.payment?.entity;
      const plId = plEntity?.id || payEntity?.payment_link_id;
      if (plId) await sendPaymentFailed(plId, eventType);
      return;
    }

    console.log(`ℹ️  Event "${eventType}" — no action needed.`);

  } catch (err) {
    console.error('❌ Event handler error:', err.message, err.stack);
  }
}

// ── Shared: send WhatsApp confirmation ───────────────────────────────────────

async function sendPaymentConfirmation(paymentLinkId, source) {
  console.log(`🔍 Looking up order for paymentLinkId: ${paymentLinkId} (source: ${source})`);

  const order = getOrderByPaymentLinkId(paymentLinkId);
  if (!order) {
    console.error(`❌ No order found for paymentLinkId: ${paymentLinkId}`);
    console.log('📋 All stored orders:', JSON.stringify(
      getAllOrders().map(o => ({ plId: o.paymentLinkId, status: o.paymentStatus, phone: o.phone }))
    ));
    return;
  }

  if (order.paymentStatus === 'PAID') {
    console.log(`ℹ️  Order ${order.id} already marked PAID — skipping duplicate confirmation.`);
    return;
  }

  updateOrderPaymentStatus(paymentLinkId, 'PAID');
  resetSession(order.phone);

  console.log(`✅ Sending confirmation to ${order.phone} for order ${order.id}`);

  // Support both new multi-item orders (order.items) and old single-item (order.item)
  const items = order.items || (order.item ? [{ ...order.item, qty: 1 }] : []);
  const total = order.total || items.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const itemLines = items.map(i => {
    const e = i.type === 'Veg' ? '🥦' : '🍗';
    return `${e} *${i.name}* x${i.qty || 1} – ₹${i.price * (i.qty || 1)}`;
  }).join('\n');

  await sendMessage(
    order.phone,
    `✅ *Payment Successful!*\n\n` +
    `🎉 Your order from *${config.restaurant.name}* is confirmed!\n\n` +
    `📦 *Items:*\n${itemLines}\n\n` +
    `💰 *Total: ₹${total}*\n\n` +
    `⏱️ Your food is being prepared. It'll be ready shortly!\n\n` +
    `Thank you for ordering with us 🙏\n\n` +
    `_Type *MENU* to place another order_`
  );

  console.log(`✅ Confirmation WhatsApp sent to ${order.phone}`);
}

// ── Shared: send payment failed message ──────────────────────────────────────

async function sendPaymentFailed(paymentLinkId, eventType) {
  const order = getOrderByPaymentLinkId(paymentLinkId);
  if (!order) return;
  if (order.paymentStatus === 'FAILED') return; // already handled

  updateOrderPaymentStatus(paymentLinkId, 'FAILED');
  resetSession(order.phone);

  console.log(`❌ Payment failed for order ${order.id}`);

  const failItems = order.items || (order.item ? [order.item] : []);
  const itemNames = failItems.map(i => i.name).join(', ') || 'your order';

  await sendMessage(
    order.phone,
    `❌ *Payment Failed*\n\n` +
    `We couldn't process your payment for *${itemNames}*.\n\n` +
    `Please try again — type *MENU* to place a new order.\n\n` +
    `_Need help? Contact us at ${config.restaurant.phone || 'our helpline'}_`
  );
}

// ── Payment success redirect page ─────────────────────────────────────────────

function handlePaymentSuccessRedirect(req, res) {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Payment Successful – ${config.restaurant.name}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:sans-serif;min-height:100vh;display:flex;align-items:center;
           justify-content:center;background:#f0fdf4;padding:1rem}
      .card{background:#fff;border-radius:16px;padding:2.5rem;text-align:center;
            max-width:380px;width:100%;box-shadow:0 4px 30px rgba(0,0,0,.1)}
      .icon{font-size:3.5rem;margin-bottom:1rem}
      h1{color:#166534;font-size:1.4rem;margin-bottom:.75rem}
      p{color:#4b5563;line-height:1.6;font-size:.95rem;margin-bottom:.5rem}
    </style></head>
    <body><div class="card">
      <div class="icon">✅</div>
      <h1>Payment Successful!</h1>
      <p>Thank you for ordering from <strong>${config.restaurant.name}</strong>.</p>
      <p>You'll receive a <strong>WhatsApp confirmation</strong> shortly.</p>
      <p><small style="color:#9ca3af">You may close this tab.</small></p>
    </div></body></html>`);
}

module.exports = { handleRazorpayWebhook, handlePaymentSuccessRedirect };