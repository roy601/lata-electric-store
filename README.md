# লতা ইলেকট্রিক — Lata Electric

A full-stack e-commerce platform for an electrical hardware shop in Dhaka, Bangladesh. Built with React, Express.js, and Supabase.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel&logoColor=white)

---

## Features

### Customer Storefront
- Product browsing with category filters, search, and sorting
- Product detail pages with image zoom, variants, and stock status
- Persistent shopping cart (Zustand) and wishlist
- Flash sales with live countdown timers
- Coupon/discount code support at checkout
- Order placement and real-time order tracking
- Customer accounts with order history
- Electricians directory for professional services

### Admin Panel
- **Dashboard** — Revenue, order, and customer metrics
- **Products** — Full CRUD with multi-image upload, pricing, variants, and stock
- **Categories & Subcategories** — Hierarchical product organisation
- **Orders** — View, update status, and manage all orders
- **Customers** — Browse customer profiles and activity
- **Featured / Top Sell / Trending** — Toggle which products appear in curated homepage sections
- **Flash Sale** — Create time-limited campaigns with sale prices
- **Banners** — Upload and manage homepage promotional banners
- **Coupons** — Generate and manage discount codes
- **Shipping** — Configure delivery zones and rates
- **Settings** — Store name, contact info, announcement bar, business hours
- **Electricians** — Manage the service professionals directory

### Security
- JWT-based auth with access + refresh tokens stored in HTTP-only cookies
- Separate auth flows for admins (JWT) and customers (Supabase Auth)
- Role-based access control (`admin`, `super_admin`)
- Rate limiting on login endpoints with configurable lockout
- Helmet security headers and CORS protection
- bcryptjs password hashing

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, React Router v6 |
| State | Zustand (cart), React Context (auth) |
| Data fetching | TanStack React Query, Axios |
| Backend | Node.js, Express.js 4 |
| Database | Supabase (managed PostgreSQL) |
| Auth | Supabase Auth (customers), JWT (admins) |
| UI | Lucide React icons, custom CSS-in-JS |
| Notifications | React Hot Toast |
| Uploads | Multer |
| Logging | Winston |
| Deployment | Vercel (frontend), Node.js host (backend) |

---

## Project Structure

```
lata_electrics/
├── client/                  # React SPA (Vite)
│   └── src/
│       ├── pages/
│       │   ├── admin/       # 15 admin panel pages
│       │   └── customer/    # 14 customer-facing pages
│       ├── components/      # ProductCard, CartSidebar, layouts
│       ├── store/           # Zustand cart store
│       ├── context/         # Admin & customer auth contexts
│       ├── api/             # Axios API helpers
│       └── lib/             # Supabase client, image utils
├── server/                  # Express.js API
│   ├── routes/              # auth, products, orders, etc.
│   ├── controllers/
│   ├── middleware/          # JWT auth, rate limiter, error handler
│   ├── models/              # Supabase schema references
│   └── utils/               # Token generation, logger, seed script
└── package.json             # Root scripts (dev, build, seed)
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/your-username/lata-electric.git
cd lata-electric
npm run install:all
```

### 2. Configure environment variables

**`server/.env`** — copy from `server/.env.example`

```env
NODE_ENV=development
PORT=5000

SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=64_byte_hex
JWT_REFRESH_SECRET=different_64_byte_hex
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

COOKIE_SECRET=32_byte_hex
CLIENT_URL=http://localhost:5173

LOGIN_MAX_ATTEMPTS=5
LOGIN_WINDOW_MINUTES=15
ACCOUNT_LOCKOUT_MINUTES=30

# First-time seed only — remove after running `npm run seed`
SEED_ADMIN_EMAIL=you@example.com
SEED_ADMIN_PASSWORD=ChangeMe@123
SEED_ADMIN_NAME=Your Name
```

**`client/.env`** — copy from `client/.env.example`

```env
VITE_API_URL=http://localhost:5000/api
```

> The Vite dev server proxies `/api` and `/uploads` to `localhost:5000` automatically.

### 3. Seed the first admin account

```bash
npm run seed
```

Remove the `SEED_ADMIN_*` variables from `server/.env` after this runs.

### 4. Start development

```bash
npm run dev
```

This starts both the Express API (`http://localhost:5000`) and the Vite dev server (`http://localhost:5173`) concurrently.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start client + server in development |
| `npm run client` | Start Vite dev server only |
| `npm run server` | Start Express server only (nodemon) |
| `npm run build` | Build React app for production |
| `npm start` | Start production Express server |
| `npm run install:all` | Install dependencies for root, client, and server |
| `npm run seed` | Create the first super admin account |

---

## Deployment

### Frontend — Vercel

The `client/vercel.json` includes an SPA rewrite rule. Deploy the `client/` directory to Vercel and set the `VITE_API_URL` environment variable to your production API URL.

### Backend — Any Node.js host

Set `NODE_ENV=production` and point `CLIENT_URL` to your frontend domain. The Express server serves the React build (`client/dist`) and all `/api` routes.

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Admin login |
| GET | `/api/products` | List products |
| POST | `/api/products` | Create product (admin) |
| PUT | `/api/products/:id` | Update product (admin) |
| DELETE | `/api/products/:id` | Delete product (admin) |
| GET | `/api/categories` | List categories |
| GET | `/api/orders` | List orders (admin) |
| POST | `/api/orders` | Place order (customer) |
| GET | `/api/customers` | List customers (admin) |
| POST | `/api/uploads` | Upload image (multipart) |
| GET/PUT | `/api/settings` | Store settings |
| GET/POST | `/api/coupons` | Coupon management |

---

## License

MIT
