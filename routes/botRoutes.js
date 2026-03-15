'use strict';

const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../controllers/botController');

/**
 * POST /webhook
 * Twilio sends incoming WhatsApp messages here.
 */
router.post('/', handleIncomingMessage);

module.exports = router;
