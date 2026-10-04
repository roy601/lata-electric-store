require('dotenv').config();
require('express-async-errors');

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const cookieParser   = require('cookie-parser');
const compression    = require('compression');
const morgan         = require('morgan');
const path           = require('path');

const { connectDB }  = require('./config/db');
const logger         = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

/* ─── Routes ── */
const authRoutes      = require('./routes/auth');
const productRoutes   = require('./routes/products');
const categoryRoutes  = require('./routes/categories');
const orderRoutes     = require('./routes/orders');
const customerRoutes  = require('./routes/customers');
const settingsRoutes  = require('./routes/settings');
const uploadRoutes    = require('./routes/uploads');
const couponRoutes    = require('./routes/coupons');
const subcategoryRoutes = require('./routes/subcategories');
const bannerRoutes      = require('./routes/banners');
const electricianRoutes = require('./routes/electricians');
const dashboardRoutes   = require('./routes/dashboard');
const aiRoutes          = require('./routes/ai');

const app  = express();
const PORT = process.env.PORT || 5000;

/* ─── Behind Render's proxy: use the real client IP for rate limiting ── */
app.set('trust proxy', 1);

/* ─── Security headers ── */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,          // managed by React build / CDN in prod
}));

/* ─── CORS ── */
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,                     // allow cookies
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

/* ─── Body & cookie parsing ── */
// Product payloads (description, specs, variants) exceed 10kb. An Excel import sends
// all its rows in one request, so that one admin route gets a larger limit.
const jsonSmall = express.json({ limit: '200kb' });
const jsonLarge = express.json({ limit: '15mb' });
app.use((req, res, next) =>
  (req.method === 'POST' && req.path === '/api/products/imports' ? jsonLarge : jsonSmall)(req, res, next));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

/* ─── Compression ── */
app.use(compression());

/* ─── HTTP logging ── */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', { stream: { write: msg => logger.info(msg.trim()) } }));
}

/* ─── Global rate limit ── */
app.use('/api', apiLimiter);

/* ─── API routes ── */
app.use('/api/auth',       authRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/customers',  customerRoutes);
app.use('/api/settings',   settingsRoutes);
app.use('/api/uploads',    uploadRoutes);
app.use('/api/coupons',    couponRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/banners',       bannerRoutes);
app.use('/api/electricians',  electricianRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/ai',            aiRoutes);

/* ─── Static uploads ── */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ─── Health check ── */
app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

/* ─── Serve React build in production ── */
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (_, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

/* ─── Error handling ── */
app.use(notFound);
app.use(errorHandler);

/* ─── Start ── */
connectDB().then(() => {
  app.listen(PORT, () =>
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
  );
}).catch(err => {
  logger.error('DB connection failed', err);
  process.exit(1);
});
