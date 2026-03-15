'use strict';

const express = require('express');
const router = express.Router();
const rawBodyMiddleware = require('../middleware/rawBody');
const { handleRazorpayWebhook, handlePaymentSuccessRedirect } = require('../controllers/paymentController');

/**
 * POST /payment/webhook
 * Razorpay webhook – raw body capture required for HMAC verification.
 */
router.post('/webhook', rawBodyMiddleware, handleRazorpayWebhook);

/**
 * GET /payment/success
 * Razorpay redirect after successful payment on the hosted payment page.
 */
router.get('/success', handlePaymentSuccessRedirect);

module.exports = router;
