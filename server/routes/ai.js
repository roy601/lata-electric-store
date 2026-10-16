const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const assistant = require('../ai/assistant');

router.use(protect, authorize('admin', 'super_admin'));

// Per-admin burst limit on questions (daily/monthly limits live in the assistant)
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.admin.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many questions in a minute. Please wait a moment.' },
});

const handle = (fn) => async (req, res) => {
  try {
    res.json({ success: true, ...(await fn(req)) });
  } catch (err) {
    if (err instanceof assistant.AssistantError) return res.status(err.status).json({ success: false, message: err.message });
    throw err;
  }
};

const uuid = (req, res, next) =>
  /^[0-9a-f-]{36}$/i.test(req.params.id) ? next() : res.status(400).json({ success: false, message: 'Invalid conversation id.' });

router.get('/status',               handle(async (req) => ({ status: await assistant.getStatus(req.admin.id) })));
router.get('/conversations',        handle(async (req) => ({ conversations: await assistant.listConversations(req.admin.id) })));
router.get('/conversations/:id',    uuid, handle(async (req) => ({ conversation: await assistant.getConversation(req.admin.id, req.params.id) })));
router.delete('/conversations/:id', uuid, handle(async (req) => { await assistant.deleteConversation(req.admin.id, req.params.id); return {}; }));

router.post('/chat', askLimiter, handle(async (req) => {
  const { conversation_id, message } = req.body || {};
  if (conversation_id != null && !/^[0-9a-f-]{36}$/i.test(String(conversation_id))) {
    throw new assistant.AssistantError('Invalid conversation id.');
  }
  return assistant.chat(req.admin, { conversationId: conversation_id || null, text: message });
}));

/* Product writer — drafts only; saving goes through PATCH /api/products/:id */
router.get('/writer/queue', handle(async () => ({ products: await assistant.productsNeedingCopy() })));
router.post('/writer/draft', askLimiter, handle(async (req) => {
  const id = parseInt(req.body?.product_id, 10);
  if (!Number.isInteger(id) || id < 1) throw new assistant.AssistantError('Choose a product.');
  return { draft: await assistant.writeProductDraft(req.admin, id) };
}));

module.exports = router;
