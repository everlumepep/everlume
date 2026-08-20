// Product detail. Renders one catalog entry and, when the authorization axes
// agree, an add-to-bag control. When they do not, it renders the honest reason
// and routes to inquiry instead — the same rule as the grid and the database.
(function () {
  const detail = document.getElementById('productDetail');
  const crumb = document.getElementById('crumbName');
  const catalog = window.everlumeCatalog;
  const cart = window.everlumeCart;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function updateCartBadge() {
    const badge = document.getElementById('cartCount');
    if (!badge) return;
    const n = cart.count();
    badge.textContent = n > 0 ? String(n) : '';
    badge.hidden = n === 0;
  }

  function notFound() {
    detail.innerHTML = `<h1 class="page-title">Material not found</h1>
      <p class="policy-lead">This material is not in the current catalog. It may have been renamed or withdrawn.</p>
      <a class="btn btn-dark" href="index.html">Back to catalog</a>`;
  }

  async function render() {
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) return notFound();
    const product = await catalog.find(slug);
    if (!product) return notFound();
    const { products } = await catalog.load();
    const variants = products.filter(item => item.name === product.name && item.category === product.category);

    const label = catalog.availabilityLabel(product);
    const price = catalog.formatPrice(product.price_cents);
    const name = escapeHtml(product.name);
    const dose = escapeHtml(product.dose_label || '—');

    document.title = `${product.name} ${product.dose_label} — Everlume`.replace(/\s+/g, ' ').trim();
    if (crumb) crumb.textContent = product.name;

    const buyBlock = label.state === 'available'
      ? `<div class="pd-buy">
           <label class="cart-qty">Qty
             <select id="pdQty">${Array.from({ length: cart.MAX_QTY }, (_, i) =>
               `<option value="${i + 1}">${i + 1}</option>`).join('')}</select>
           </label>
           <button class="btn btn-dark" id="pdAdd" type="button">Add to bag</button>
           <p class="pd-status" id="pdStatus" role="status" aria-live="polite"></p>
         </div>`
      : `<div class="pd-buy pd-buy-closed">
           <p class="pd-closed-reason">${escapeHtml(label.text)}</p>
           <p class="summary-note">This material is presented for documentation and inquiry. It is not offered for purchase on this site.</p>
           <a class="btn btn-dark" href="index.html#contact">Request documentation</a>
         </div>`;

    detail.innerHTML = `<div class="pd-layout">
      <div class="pd-visual">
        <div class="mini-vial"><img src="assets/products/everlume-vial-master-v1.png" alt="" width="1024" height="1365"><span>EVERLUME</span><b>${escapeHtml(product.sku)}</b><small>RESEARCH ONLY</small></div>
      </div>
      <div class="pd-copy">
        <p class="eyebrow">${escapeHtml(product.category)} research</p>
        <h1 class="page-title">${name}</h1>
        ${variants.length > 1 ? `<label class="variant-picker pd-variant-picker"><span>Dosage</span><select id="pdVariant" aria-label="Select ${name} dosage">${variants.map(variant => `<option value="${escapeHtml(variant.slug)}"${variant.slug === product.slug ? ' selected' : ''}>${escapeHtml(variant.dose_label || '—')}</option>`).join('')}</select></label>` : `<p class="pd-dose">${dose}</p>`}
        <p class="policy-lead">${escapeHtml(product.description)}</p>
        <dl class="pd-specs">
          <div><dt>SKU</dt><dd>${escapeHtml(product.sku)}</dd></div>
          <div><dt>Format</dt><dd>${dose}</dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(product.category)}</dd></div>
          <div><dt>Availability</dt><dd><span class="avail avail-${label.state}">${escapeHtml(label.text)}</span></dd></div>
          ${price ? `<div><dt>Price</dt><dd>${escapeHtml(price)}</dd></div>` : ''}
        </dl>
        ${buyBlock}
        <p class="policy-note">For laboratory research and educational use only. Not for human or veterinary use. Everlume makes no medical, therapeutic, or efficacy claims. See the <a href="research-use.html">research-use policy</a>.</p>
      </div>
    </div>`;

    const addBtn = document.getElementById('pdAdd');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const qty = Number(document.getElementById('pdQty').value) || 1;
        addBtn.disabled = true;
        const result = await cart.add(product.slug, qty);
        addBtn.disabled = false;
        const status = document.getElementById('pdStatus');
        status.textContent = result.ok
          ? (result.capped ? 'Added — quantity limited by available stock.' : 'Added to your bag.')
          : 'This material is not available for purchase.';
        updateCartBadge();
      });
    }
    const variantSelect = document.getElementById('pdVariant');
    if (variantSelect) {
      variantSelect.addEventListener('change', () => {
        location.href = 'product.html?slug=' + encodeURIComponent(variantSelect.value);
      });
    }
  }

  render();
  updateCartBadge();
  if (cart) cart.onChange(updateCartBadge);
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
