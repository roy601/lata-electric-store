/* admin.js — core admin framework: auth guard, sidebar, topbar, toast, utilities */

/* ---- Auth guard (skip on login page) ---- */
if (!location.pathname.includes('login.html') && !Store.auth.isLoggedIn()) {
  const depth = location.pathname.includes('/pages/') ? '../' : '';
  location.href = depth + '../login.html';
}

/* ---- Sidebar nav config ---- */
const NAV = [
  { section: 'Main' },
  { page: 'dashboard', label: 'Dashboard',     icon: 'bi-speedometer2',     href: '../index.html' },
  { section: 'Catalogue' },
  { page: 'products',   label: 'Products',      icon: 'bi-box-seam',         href: 'products.html' },
  { page: 'categories', label: 'Categories',    icon: 'bi-grid',             href: 'categories.html' },
  { page: 'featured',   label: 'Featured / Top Sells', icon: 'bi-star',     href: 'featured.html' },
  { page: 'flash-sale', label: 'Flash Sale',    icon: 'bi-lightning-charge', href: 'flash-sale.html' },
  { section: 'Sales' },
  { page: 'orders',     label: 'Orders',        icon: 'bi-bag',              href: 'orders.html' },
  { page: 'customers',  label: 'Customers',     icon: 'bi-people',           href: 'customers.html' },
  { section: 'Config' },
  { page: 'payments',   label: 'Payments',      icon: 'bi-credit-card',      href: 'payments.html' },
  { page: 'shipping',   label: 'Shipping',      icon: 'bi-truck',            href: 'shipping.html' },
  { page: 'settings',   label: 'Settings',      icon: 'bi-gear',             href: 'settings.html' },
];

const currentPage = document.body.dataset.page || '';

/* ---- Inject sidebar ---- */
function buildSidebar() {
  const el = document.getElementById('adminSidebar');
  if (!el) return;

  const isPagesDir = location.pathname.includes('/pages/');
  const imgSrc     = isPagesDir ? '../../assets/images/logo.jpg' : '../assets/images/logo.jpg';
  const homeHref   = isPagesDir ? '../index.html' : 'index.html';
  const pagesBase  = isPagesDir ? '' : 'pages/';

  let html = `
    <a class="sidebar-brand" href="${homeHref}">
      <img src="${imgSrc}" class="sidebar-logo" alt="logo" onerror="this.style.display='none'">
      <div class="sidebar-brand-text">
        <div class="bn">লতা ইলেকট্রিক</div>
        <div class="en">Lata Electric</div>
        <div class="role">Admin Panel</div>
      </div>
    </a>`;

  NAV.forEach(item => {
    if (item.section) {
      html += `<div class="sidebar-section"><div class="sidebar-section-label">${item.section}</div>`;
    } else {
      const active = item.page === currentPage ? 'active' : '';
      const href   = item.page === 'dashboard' ? homeHref : pagesBase + item.href;
      html += `<a class="sidebar-link ${active}" href="${href}" data-page="${item.page}">
        <i class="bi ${item.icon}"></i><span>${item.label}</span></a>`;
      if (NAV[NAV.indexOf(item)+1]?.section || NAV.indexOf(item) === NAV.length-1) html += `</div>`;
    }
  });

  html += `<div class="sidebar-footer">
    <a href="#" onclick="Store.auth.logout();location.href='${isPagesDir?'../':''}login.html';return false;">
      <i class="bi bi-box-arrow-left"></i> Logout
    </a>
  </div>`;

  el.innerHTML = html;
}

/* ---- Inject topbar ---- */
function buildTopbar(title, subtitle) {
  const el = document.getElementById('adminTopbar');
  if (!el) return;
  const orderCount = Store.orders.stats().pending;
  el.innerHTML = `
    <button class="sidebar-toggle" onclick="toggleSidebar()"><i class="bi bi-list"></i></button>
    <div>
      <div class="topbar-title">${title || 'Admin'}</div>
      ${subtitle ? `<div class="topbar-sub">${subtitle}</div>` : ''}
    </div>
    <div class="topbar-actions">
      <a href="../../index.html" target="_blank" class="topbar-btn" title="View Site"><i class="bi bi-box-arrow-up-right"></i></a>
      <button class="topbar-btn" title="Orders">
        <i class="bi bi-bag"></i>
        ${orderCount ? `<span class="topbar-badge">${orderCount}</span>` : ''}
      </button>
      <div class="topbar-admin">
        <div class="topbar-admin-avatar">A</div>
        <span class="topbar-admin-name d-none d-md-inline">Admin</span>
      </div>
    </div>`;
}

/* ---- Mobile sidebar toggle ---- */
function toggleSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
  let overlay = document.getElementById('adminOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'adminOverlay';
    overlay.className = 'admin-overlay';
    overlay.onclick   = toggleSidebar;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('active');
}

/* ---- Toast notification ---- */
function toast(msg, type = 'success') {
  let el = document.getElementById('adminToast');
  if (!el) { el = document.createElement('div'); el.id = 'adminToast'; document.body.appendChild(el); }
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-circle-fill' };
  el.className = `show ${type}`;
  el.innerHTML = `<i class="bi ${icons[type]||icons.success}"></i> ${msg}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ---- Confirm dialog ---- */
function confirmDelete(msg, cb) {
  if (confirm(msg || 'Are you sure you want to delete this item?')) cb();
}

/* ---- Format currency ---- */
function taka(n) { return '৳' + Number(n||0).toLocaleString('en-BD'); }

/* ---- Format date ---- */
function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

/* ---- Status badge HTML ---- */
function statusBadge(status) {
  const map = {
    pending:   ['status-pending',   'Pending'],
    shipped:   ['status-shipped',   'Shipped'],
    delivered: ['status-delivered', 'Delivered'],
    cancelled: ['status-cancelled', 'Cancelled'],
    active:    ['status-active',    'Active'],
    inactive:  ['status-inactive',  'Inactive'],
  };
  const [cls, label] = map[status] || ['status-pending', status];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

/* ---- Product img HTML ---- */
function productImg(img, name) {
  return img
    ? `<img src="${img}" class="td-img" alt="${name}">`
    : `<div class="td-img-placeholder"><i class="bi bi-image"></i></div>`;
}

/* ---- Category name lookup ---- */
function catName(id) {
  const c = Store.categories.byId(id);
  return c ? c.name : '—';
}

/* ---- Pagination helper ---- */
function paginate(arr, page, perPage) {
  const total = arr.length;
  const pages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  return { items: arr.slice(start, start + perPage), total, pages, page };
}

function renderPagination(containerId, current, total, onChange) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
  let html = '<nav><ul class="pagination pagination-sm mb-0">';
  html += `<li class="page-item${current===1?' disabled':''}"><a class="page-link" href="#" data-p="${current-1}">‹</a></li>`;
  for (let i=1; i<=total; i++) {
    html += `<li class="page-item${i===current?' active':''}"><a class="page-link" href="#" data-p="${i}">${i}</a></li>`;
  }
  html += `<li class="page-item${current===total?' disabled':''}"><a class="page-link" href="#" data-p="${current+1}">›</a></li>`;
  html += '</ul></nav>';
  el.innerHTML = html;
  el.querySelectorAll('.page-link').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); const p = +a.dataset.p; if (p>=1 && p<=total) onChange(p); });
  });
}

/* ---- Init on load ---- */
document.addEventListener('DOMContentLoaded', async () => {
  await Store.init();
  buildSidebar();

  /* topbar title from data-title on body */
  const title    = document.body.dataset.title    || '';
  const subtitle = document.body.dataset.subtitle || '';
  buildTopbar(title, subtitle);
});
