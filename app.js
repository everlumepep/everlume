// Everlume storefront. Loaded after js/catalog.js and js/cart.js.
//
// The catalog renders from window.everlumeCatalog, which is the same
// authorization rule the database enforces: a product is only offered for
// purchase when its status, compliance state, price, and stock all agree.
// Today every seeded product is pending_review, so every card renders as an
// inquiry — the buy path exists but is closed, and there is no way to force it.
(function () {
  const grid = document.getElementById('productGrid');
  const catalog = window.everlumeCatalog;
  const cart = window.everlumeCart;
  let allProducts = [];
  let activeFilter = 'all';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function cardMarkup(product) {
    const label = catalog.availabilityLabel(product);
    const price = catalog.formatPrice(product.price_cents);
    const name = escapeHtml(product.name);
    const dose = escapeHtml(product.dose_label || '—');
    const href = 'product.html?slug=' + encodeURIComponent(product.slug);

    const action = label.state === 'available'
      ? `<button class="add-btn" data-slug="${escapeHtml(product.slug)}">Add to bag</button>`
      : `<button class="request-btn" data-product="${name} ${dose}">Inquire</button>`;

    return `<article class="product-card reveal visible">
      <a class="product-visual" href="${href}" aria-label="${name} ${dose} details">
        <div class="mini-vial"><span>EL</span><b>${name.toUpperCase()}</b><small>${dose}</small></div>
      </a>
      <div class="product-copy">
        <div class="dose">${dose}</div>
        <h3><a href="${href}">${name}</a></h3>
        <p>${escapeHtml(product.description)}</p>
        <p class="product-meta"><span class="sku">${escapeHtml(product.sku)}</span><span class="avail avail-${label.state}">${escapeHtml(label.text)}</span></p>
        <div class="product-bottom">
          <span class="quote-label">${price ? escapeHtml(price) : 'Documentation available'}</span>
          ${action}
        </div>
      </div>
    </article>`;
  }

  function render() {
    if (!grid) return;
    const shown = allProducts.filter(p => activeFilter === 'all' || p.category === activeFilter);
    grid.innerHTML = shown.length
      ? shown.map(cardMarkup).join('')
      : '<p class="empty-note">No materials in this category.</p>';
    bindRequestButtons();
    bindAddButtons();
  }

  function bindRequestButtons() {
    document.querySelectorAll('.request-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = document.getElementById('productField');
        if (field) field.value = btn.dataset.product || '';
        const contact = document.getElementById('contact');
        if (contact) contact.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  function bindAddButtons() {
    document.querySelectorAll('.add-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const result = await cart.add(btn.dataset.slug, 1);
        btn.disabled = false;
        btn.textContent = result.ok ? 'Added ✦' : 'Unavailable';
        setTimeout(() => { btn.textContent = 'Add to bag'; }, 1600);
        updateCartBadge();
      });
    });
  }

  function updateCartBadge() {
    const badge = document.getElementById('cartCount');
    if (!badge) return;
    const n = cart.count();
    badge.textContent = n > 0 ? String(n) : '';
    badge.hidden = n === 0;
  }

  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  if (grid) {
    catalog.load().then(({ products }) => {
      allProducts = products;
      render();
    });
  }
  updateCartBadge();
  if (cart) cart.onChange(updateCartBadge);

  // ── Navigation ───────────────────────────────────────────────────────────
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if (menu && nav) {
    const setMenu = open => {
      nav.classList.toggle('open', open);
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    menu.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menu.focus(); }
    });
  }

  // ── Reveal animations ────────────────────────────────────────────────────
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    }), { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  }

  // ── Inquiry form ─────────────────────────────────────────────────────────
  const inquiry = document.getElementById('inquiryForm');
  if (inquiry) {
    inquiry.addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const status = document.getElementById('formStatus');
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Submitting…';
      status.textContent = '';
      try {
        const response = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString()
        });
        if (!response.ok) throw new Error('Submission failed');
        form.reset();
        status.textContent = 'Thank you. Your research inquiry has been received.';
      } catch (error) {
        status.textContent = 'We could not submit your inquiry. Please try again shortly.';
      } finally {
        button.disabled = false;
        button.textContent = 'Submit inquiry';
      }
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
