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
  const selectedVariants = new Map();

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function groupProducts(products) {
    const groups = new Map();
    products.forEach(product => {
      const key = `${product.category}:${product.name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    });
    return Array.from(groups.entries()).map(([key, variants]) => ({
      key,
      variants,
      product: variants.find(item => item.slug === selectedVariants.get(key)) || variants[0]
    }));
  }

  function cardMarkup(group) {
    const { product, variants, key } = group;
    const label = catalog.availabilityLabel(product);
    const price = catalog.formatPrice(product.price_cents);
    const name = escapeHtml(product.name);
    const dose = escapeHtml(product.dose_label || '—');
    const href = 'product.html?slug=' + encodeURIComponent(product.slug);
    const doseControl = variants.length > 1
      ? `<label class="variant-picker"><span>Dosage</span><select data-variant-group="${escapeHtml(key)}" aria-label="Select ${name} dosage">${variants.map(variant =>
          `<option value="${escapeHtml(variant.slug)}"${variant.slug === product.slug ? ' selected' : ''}>${escapeHtml(variant.dose_label || '—')}</option>`
        ).join('')}</select></label>`
      : `<div class="dose">${dose}</div>`;

    const action = label.state === 'available'
      ? `<button class="add-btn" data-slug="${escapeHtml(product.slug)}">Add to bag</button>`
      : `<button class="request-btn" data-product="${name} ${dose}">Inquire</button>`;

    return `<article class="product-card reveal visible" data-category="${escapeHtml(product.category)}">
      <a class="product-visual" href="${href}" aria-label="${name} ${dose} details">
        <div class="mini-vial"><img src="assets/products/everlume-vial-master-v1.png" alt="" width="1024" height="1365" loading="lazy"><span>EVERLUME</span><b>${escapeHtml(product.sku)}</b><small>RESEARCH ONLY</small></div>
      </a>
      <div class="product-copy">
        <p class="product-cat">${escapeHtml(product.category)} research</p>
        ${doseControl}
        <h3><a href="${href}">${name}</a></h3>
        <p>${escapeHtml(product.description)}</p>
        <p class="product-meta"><span class="sku">${escapeHtml(product.sku)}</span><span class="avail avail-${label.state}">${escapeHtml(label.text)}</span></p>
        <div class="product-bottom">
          <span class="${price ? 'product-price' : 'quote-label'}">${price ? escapeHtml(price) : 'Documentation available'}</span>
          ${action}
        </div>
      </div>
    </article>`;
  }

  function render() {
    if (!grid) return;
    const shown = groupProducts(allProducts.filter(p => activeFilter === 'all' || p.category === activeFilter));
    grid.innerHTML = shown.length
      ? shown.map(cardMarkup).join('')
      : '<p class="empty-note">No materials in this category.</p>';
    bindRequestButtons();
    bindAddButtons();
    bindVariantPickers();
  }

  function bindVariantPickers() {
    document.querySelectorAll('[data-variant-group]').forEach(select => {
      select.addEventListener('change', () => {
        selectedVariants.set(select.dataset.variantGroup, select.value);
        render();
      });
    });
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

  function applyCommerceVisibility() {
    if (catalog.commerceEnabled()) return;
    // Inquiry-only: remove the bag entry points entirely rather than leaving a
    // link to a page that can only say "no".
    document.querySelectorAll('.nav-bag').forEach(el => el.remove());
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
  applyCommerceVisibility();
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

  // Signature light moment. Pointer position only controls a decorative glow;
  // scroll depth is intentionally shallow and disabled for reduced motion.
  const lumeMoment = document.querySelector('.lume-moment');
  if (lumeMoment && !reducedMotion) {
    if (window.matchMedia('(pointer:fine)').matches) {
      lumeMoment.addEventListener('pointermove', event => {
        const bounds = lumeMoment.getBoundingClientRect();
        lumeMoment.style.setProperty('--mx', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
        lumeMoment.style.setProperty('--my', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
      });
    }
    let lumeFrame = 0;
    const updateLumeDepth = () => {
      lumeFrame = 0;
      const bounds = lumeMoment.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) return;
      const progress = (innerHeight - bounds.top) / (innerHeight + bounds.height);
      lumeMoment.style.setProperty('--lume-shift', `${(progress - .5) * 28}px`);
    };
    addEventListener('scroll', () => {
      if (!lumeFrame) lumeFrame = requestAnimationFrame(updateLumeDepth);
    }, { passive: true });
    updateLumeDepth();
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
