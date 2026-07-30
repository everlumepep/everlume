// Bag page. Renders resolved cart lines and keeps quantity edits honest —
// every total is recomputed from the catalog, never read from storage.
(function () {
  const linesEl = document.getElementById('cartLines');
  const summaryEl = document.getElementById('cartSummary');
  const stateEl = document.getElementById('cartState');
  const cart = window.everlumeCart;
  const catalog = window.everlumeCatalog;

  const REJECTION_COPY = {
    no_longer_listed: 'No longer listed',
    compliance_review_pending: 'Not available for purchase — inquiries only',
    no_price: 'Not available for purchase — inquiries only',
    invalid_price: 'Not available for purchase — inquiries only',
    out_of_stock: 'Out of stock',
    not_active: 'No longer available'
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function lineMarkup(item) {
    const options = [];
    for (let i = 1; i <= cart.MAX_QTY; i += 1) {
      options.push(`<option value="${i}"${i === item.qty ? ' selected' : ''}>${i}</option>`);
    }
    return `<article class="cart-line">
      <div class="cart-line-main">
        <h3>${escapeHtml(item.name)}</h3>
        <p class="cart-line-meta">${escapeHtml(item.dose_label || '—')} · <span class="sku">${escapeHtml(item.sku)}</span></p>
        ${item.cappedFrom ? `<p class="cart-note">Quantity reduced to available stock.</p>` : ''}
      </div>
      <label class="cart-qty">Qty
        <select data-slug="${escapeHtml(item.slug)}">${options.join('')}</select>
      </label>
      <div class="cart-line-price">${escapeHtml(catalog.formatPrice(item.lineCents))}</div>
      <button class="request-btn cart-remove" data-slug="${escapeHtml(item.slug)}" type="button">Remove</button>
    </article>`;
  }

  function rejectedMarkup(entry) {
    return `<article class="cart-line cart-line-rejected">
      <div class="cart-line-main">
        <h3>${escapeHtml(entry.name)}</h3>
        <p class="cart-line-meta">${escapeHtml(REJECTION_COPY[entry.reason] || 'Unavailable')}</p>
      </div>
      <button class="request-btn cart-remove" data-slug="${escapeHtml(entry.slug)}" type="button">Remove</button>
    </article>`;
  }

  async function render() {
    const { items, rejected, subtotalCents } = await cart.resolve();

    if (!items.length && !rejected.length) {
      linesEl.innerHTML = `<div class="cart-empty">
        <h3>Your bag is empty.</h3>
        <p>Browse the research collection to add materials, or submit an inquiry for documentation and availability.</p>
        <a class="btn btn-dark" href="index.html">Browse catalog</a>
      </div>`;
      summaryEl.hidden = true;
      stateEl.textContent = '';
      return;
    }

    linesEl.innerHTML = items.map(lineMarkup).join('') + rejected.map(rejectedMarkup).join('');

    if (rejected.length) {
      stateEl.innerHTML = `<p class="cart-alert">${rejected.length} item${rejected.length > 1 ? 's are' : ' is'} not currently available for purchase and ${rejected.length > 1 ? 'have' : 'has'} been held out of your total.</p>`;
    } else {
      stateEl.textContent = '';
    }

    summaryEl.hidden = items.length === 0;
    document.getElementById('sumSubtotal').textContent = catalog.formatPrice(subtotalCents) || '$0.00';

    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
      const blocked = items.length === 0;
      checkoutBtn.setAttribute('aria-disabled', String(blocked));
      checkoutBtn.classList.toggle('is-disabled', blocked);
    }

    linesEl.querySelectorAll('select[data-slug]').forEach(select => {
      select.addEventListener('change', () => {
        cart.update(select.dataset.slug, select.value);
        render();
      });
    });
    linesEl.querySelectorAll('.cart-remove').forEach(btn => {
      btn.addEventListener('click', () => { cart.remove(btn.dataset.slug); render(); });
    });
  }

  const clear = document.getElementById('clearCart');
  if (clear) clear.addEventListener('click', () => { cart.clear(); render(); });

  render();
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
