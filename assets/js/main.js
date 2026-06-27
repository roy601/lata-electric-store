/* main.js — site-wide UI: search, active nav, back-to-top */

document.addEventListener('DOMContentLoaded', () => {

  /* ----- Active nav link ----- */
  const currentPath = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.secondary-nav-items .nav-link').forEach(link => {
    const href = link.getAttribute('href').split('/').pop().split('?')[0];
    if (href === currentPath) link.classList.add('active');
  });

  /* ----- Search ----- */
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = encodeURIComponent(searchInput.value.trim());
        if (q) {
          const depth  = location.pathname.split('/').filter(Boolean).length;
          const prefix = depth <= 1 ? '' : '../';
          location.href = `${prefix}pages/all-products.html?q=${q}`;
        }
      }
    });
  }

  /* ----- Back-to-top (injected automatically) ----- */
  const btn = document.createElement('button');
  btn.id        = 'backToTop';
  btn.innerHTML = '<i class="bi bi-arrow-up"></i>';
  btn.setAttribute('aria-label', 'Back to top');
  document.body.appendChild(btn);

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  });

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

});
