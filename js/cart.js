// Everlume cart. Loaded after js/catalog.js.
// Exposes window.everlumeCart.
//
// The cart is a CLIENT CONVENIENCE, not a source of financial truth (G5).
// It stores slugs and quantities only — never prices. Every total is recomputed
// from the catalog on read, so a tampered localStorage cannot change what an
// order costs. Server-side order creation re-derives prices independently.
(function () {
  const KEY = 'everlume.cart';
  const MAX_QTY = 10;
  const listeners = new Set();

  function readRaw() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(line => line && typeof line.slug === 'string')
        .map(line => ({ slug: line.slug, qty: clampQty(line.qty) }))
        .filter(line => line.qty > 0);
    } catch (error) {
      return [];
    }
  }

  function writeRaw(lines) {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch (error) {
      // Storage unavailable (private mode, quota). The cart degrades to
      // in-memory for this page view rather than throwing at the customer.
    }
    listeners.forEach(fn => {
      try { fn(); } catch (error) { /* a bad listener must not break the cart */ }
    });
  }

  function clampQty(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, MAX_QTY);
  }

  function count() {
    return readRaw().reduce((sum, line) => sum + line.qty, 0);
  }

  // Resolve stored slugs against the live catalog. Anything that is no longer
  // purchasable is surfaced as a rejected line rather than silently dropped —
  // the customer is told why, and it never reaches a total.
  async function resolve() {
    const lines = readRaw();
    if (!lines.length) return { items: [], rejected: [], subtotalCents: 0, count: 0 };
    const { products } = await window.everlumeCatalog.load();
    const items = [];
    const rejected = [];
    for (const line of lines) {
      const product = products.find(p => p.slug === line.slug);
      if (!product) {
        rejected.push({ slug: line.slug, name: line.slug, reason: 'no_longer_listed' });
        continue;
      }
      const { purchasable, reasons } = window.everlumeCatalog.availability(product);
      if (!purchasable) {
        rejected.push({ slug: product.slug, name: product.name, reason: reasons[0] });
        continue;
      }
      const stock = window.everlumeCatalog.available(product);
      const qty = Math.min(line.qty, stock);
      items.push({
        slug: product.slug,
        name: product.name,
        dose_label: product.dose_label,
        sku: product.sku,
        unitCents: product.price_cents,
        qty,
        cappedFrom: qty < line.qty ? line.qty : null,
        lineCents: product.price_cents * qty
      });
    }
    const subtotalCents = items.reduce((sum, item) => sum + item.lineCents, 0);
    return { items, rejected, subtotalCents, count: items.reduce((s, i) => s + i.qty, 0) };
  }

  // Refuses to add anything the catalog does not authorize. This is the same
  // rule the database enforces; the UI simply must not offer a path around it.
  async function add(slug, qty) {
    const product = await window.everlumeCatalog.find(slug);
    if (!product) return { ok: false, reason: 'not_found' };
    const { purchasable, reasons } = window.everlumeCatalog.availability(product);
    if (!purchasable) return { ok: false, reason: reasons[0] };

    const lines = readRaw();
    const existing = lines.find(line => line.slug === slug);
    const stock = window.everlumeCatalog.available(product);
    const want = clampQty((existing ? existing.qty : 0) + (qty || 1));
    const finalQty = Math.min(want, stock, MAX_QTY);
    if (finalQty <= 0) return { ok: false, reason: 'out_of_stock' };

    if (existing) existing.qty = finalQty;
    else lines.push({ slug, qty: finalQty });
    writeRaw(lines);
    return { ok: true, qty: finalQty, capped: finalQty < want };
  }

  function update(slug, qty) {
    const lines = readRaw().filter(line => line.slug !== slug);
    const next = clampQty(qty);
    if (next > 0) lines.push({ slug, qty: next });
    writeRaw(lines);
  }

  function remove(slug) {
    writeRaw(readRaw().filter(line => line.slug !== slug));
  }

  function clear() {
    writeRaw([]);
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // Cart is per-browser; a second tab editing it should not desync this one.
  window.addEventListener('storage', event => {
    if (event.key === KEY) listeners.forEach(fn => { try { fn(); } catch (error) { /* ignore */ } });
  });

  window.everlumeCart = { add, update, remove, clear, count, resolve, onChange, MAX_QTY };
})();
