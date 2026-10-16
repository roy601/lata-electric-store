/**
 * Public storefront assistant: POST /api/shop-ai/chat
 * { messages: [{role, content}], product_id? } → { reply, products }
 *
 * Protects the free AI quota: per-visitor limits plus a daily cap for the
 * whole shop (SHOP_AI_DAILY_LIMIT, default 800 answers a day).
 */
const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();
const logger    = require('../utils/logger');
const assistant = require('../ai/assistant');
const { shopChat } = require('../ai/shopAssistant');

const DAILY = +process.env.SHOP_AI_DAILY_LIMIT || 800;
let day = '', count = 0;
const dhakaDay = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);

const burst = rateLimit({ windowMs: 5 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'You are asking very fast — please wait a minute.' } });
const perDay = rateLimit({ windowMs: 24 * 3600 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'You have reached today\'s question limit. For more help, message us on WhatsApp.' } });

router.get('/status', (req, res) => res.json({ success: true, enabled: assistant.isConfigured() }));

router.post('/chat', burst, perDay, async (req, res) => {
  if (!assistant.isConfigured()) return res.status(503).json({ success: false, message: 'The shop assistant is not available right now.' });
  if (dhakaDay() !== day) { day = dhakaDay(); count = 0; }
  if (count >= DAILY) return res.status(429).json({ success: false, message: 'The assistant is very busy today. Please message us on WhatsApp.' });
  const productId = parseInt(req.body?.product_id, 10);
  try {
    count++;
    const out = await shopChat(assistant.getProvider(), req.body?.messages, { productId: Number.isInteger(productId) ? productId : undefined }, assistant.replyLanguage);
    res.json({ success: true, reply: out.reply, products: out.products });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
    const described = assistant.getProvider().describeError(err);
    logger.error(`Shop assistant failed: ${err.message}`);
    res.status(described?.status || 500).json({ success: false, message: 'Sorry, I could not answer right now. Please try again or message us on WhatsApp.' });
  }
});

module.exports = router;
