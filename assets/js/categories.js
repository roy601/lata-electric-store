/* categories.js — loads data/categories.json and renders sidebar + grid */

const BASE = document.querySelector('base')?.href || '';

/* Resolve the JSON path relative to root whether we are on index or pages/ */
const depth  = location.pathname.split('/').filter(Boolean).length;
const prefix = depth <= 1 ? '' : '../';

fetch(prefix + 'data/categories.json')
  .then(r => r.json())
  .then(cats => {
    window.CATEGORIES = cats;
    renderSidebar(cats);
    renderGrid(cats);
  })
  .catch(() => console.warn('Could not load categories.json'));

/* ---------- Sidebar ---------- */
function renderSidebar(cats) {
  const list   = document.getElementById('categoryList');
  const flyout = document.getElementById('categoryFlyout');
  const fTitle = document.getElementById('flyoutTitle');
  const fProds = document.getElementById('flyoutProducts');
  if (!list) return;

  cats.forEach(cat => {
    const li = document.createElement('li');
    li.innerHTML = `
      <a href="${prefix}pages/category.html?id=${cat.id}" data-id="${cat.id}">
        <span class="cat-icon" style="background:${cat.color}20;color:${cat.color}">
          <i class="bi ${cat.icon}"></i>
        </span>
        ${cat.name}
        <i class="bi bi-chevron-right chevron"></i>
      </a>`;
    list.appendChild(li);

    li.querySelector('a').addEventListener('mouseenter', () => {
      fTitle.textContent = cat.name;
      fProds.innerHTML   = cat.products
        .map(p => `<li><a href="${prefix}pages/category.html?id=${cat.id}">${p}</a></li>`)
        .join('');
      flyout.classList.remove('d-none');

      const rect = list.closest('.category-panel').getBoundingClientRect();
      flyout.style.left      = rect.right + 'px';
      flyout.style.top       = Math.max(80, rect.top) + 'px';
      flyout.style.maxHeight = (window.innerHeight - Math.max(80, rect.top) - 16) + 'px';
      flyout.style.width     = '220px';
    });
  });

  const panel = list.closest('.category-panel');
  panel  && panel.addEventListener('mouseleave',  () => flyout.classList.add('d-none'));
  flyout && flyout.addEventListener('mouseleave', () => flyout.classList.add('d-none'));
  flyout && flyout.addEventListener('mouseenter', () => flyout.classList.remove('d-none'));
}

/* ---------- Grid ---------- */
function renderGrid(cats) {
  const grid = document.getElementById('categoryGrid');
  if (!grid) return;

  cats.forEach(cat => {
    const col = document.createElement('div');
    col.className = 'col-6 col-sm-4 col-md-3';
    col.innerHTML = `
      <a class="cat-grid-card" href="${prefix}pages/category.html?id=${cat.id}">
        <div class="cat-grid-icon" style="background:${cat.color}">
          <i class="bi ${cat.icon}"></i>
        </div>
        <div class="cat-grid-name">${cat.name}</div>
        <div class="cat-grid-count">${cat.products.length} products</div>
      </a>`;
    grid.appendChild(col);
  });
}
