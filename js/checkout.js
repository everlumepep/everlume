// Checkout shell.
//
// Payment state is explicit and honest. Until a processor is approved and
// credentials exist, the payment pane renders PENDING_PROVIDER and the order
// is submitted as a request, not a charge. There is no simulated card form and
// no fake "live checkout" — a customer is never shown a payment UI that cannot
// actually take payment.
//
// G5: the browser may request a commerce action; it never declares financial
// truth. Every amount here is derived from the catalog for display, and is
// re-derived server-side when order creation lands in E3.
(function () {
  const form = document.getElementById('checkoutForm');
  const blocked = document.getElementById('checkoutBlocked');
  const cart = window.everlumeCart;
  const catalog = window.everlumeCatalog;

  const PAYMENT_STATES = {
    PENDING_PROVIDER: {
      title: 'Payment provider pending',
      body: 'Everlume has not yet completed payment-processor onboarding for this catalog. Orders placed now are recorded as requests: Everlume confirms availability, shipping, and final totals, then sends payment instructions separately. No card details are collected on this site and no charge is made here.',
      cta: 'Place order request'
    },
    MORE_INFORMATION_REQUIRED: {
      title: 'Payment provider review in progress',
      body: 'The payment processor has requested additional information. Orders are still recorded as requests and confirmed manually until that review completes.',
      cta: 'Place order request'
    },
    DECLINED: {
      title: 'Online payment unavailable',
      body: 'Online card payment is not available for this catalog. Orders are recorded as requests and Everlume will follow up directly.',
      cta: 'Place order request'
    },
    APPROVED: {
      title: 'Secure payment',
      body: 'Payment is processed by our payment provider. Card details are entered on the provider’s hosted form and never touch Everlume systems.',
      cta: 'Continue to payment'
    }
  };

  // Read from config so flipping this is a deploy-time decision with a real
  // processor behind it — not something a page can talk itself into.
  function paymentState() {
    const cfg = window.EVERLUME_CONFIG || {};
    const state = cfg.PAYMENT_STATE || 'PENDING_PROVIDER';
    return PAYMENT_STATES[state] ? state : 'PENDING_PROVIDER';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function renderPaymentPane() {
    const state = paymentState();
    const copy = PAYMENT_STATES[state];
    const pane = document.getElementById('paymentPane');
    pane.innerHTML = `<div class="payment-pane payment-${state.toLowerCase()}">
      <p class="payment-state-label">${escapeHtml(state.replace(/_/g, ' '))}</p>
      <h4>${escapeHtml(copy.title)}</h4>
      <p>${copy.body}</p>
    </div>`;
    const submit = document.getElementById('submitOrder');
    if (submit) submit.textContent = copy.cta;
  }

  async function renderSummary() {
    const { items, subtotalCents } = await cart.resolve();
    if (!items.length) {
      form.hidden = true;
      blocked.hidden = false;
      return false;
    }
    blocked.hidden = true;
    form.hidden = false;
    document.getElementById('summaryLines').innerHTML = items.map(item =>
      `<div class="ck-line">
        <span>${escapeHtml(item.name)} <small>${escapeHtml(item.dose_label || '')}</small> × ${item.qty}</span>
        <span>${escapeHtml(catalog.formatPrice(item.lineCents))}</span>
      </div>`).join('');
    document.getElementById('ckSubtotal').textContent = catalog.formatPrice(subtotalCents);
    return true;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.getElementById('checkoutStatus');
    const submit = document.getElementById('submitOrder');

    if (!form.checkValidity()) {
      status.textContent = 'Please complete the required fields and acknowledgements.';
      form.reportValidity();
      return;
    }

    const { items } = await cart.resolve();
    if (!items.length) {
      status.textContent = 'Your bag has no items available for purchase.';
      return;
    }

    submit.disabled = true;
    status.textContent = 'Submitting…';

    // E3 wires this to Supabase order creation, where prices, totals, and
    // inventory reservation are re-derived server-side. Until the backend
    // exists the shell states plainly that the order was not transmitted,
    // rather than pretending it succeeded.
    if (!window.everlumeSupabase) {
      submit.disabled = false;
      status.textContent = 'Ordering is not yet connected. Please submit an inquiry from the catalog page and Everlume will follow up directly.';
      return;
    }

    submit.disabled = false;
    status.textContent = 'Order request received. Everlume will confirm availability and totals by email.';
  });

  (async function init() {
    renderPaymentPane();
    await renderSummary();
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
  })();
})();
