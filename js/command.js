// XENTH / EVERLUME COMMAND — admin foundation.
// This shell is intentionally thin: navigation, role-gated entry, and live
// counts where they are cheap. Hiding the UI is NOT the security boundary —
// every query here is enforced server-side by Postgres RLS role checks, so a
// customer who discovers this URL sees nothing and can read nothing.
(function () {
  const client = window.everlumeSupabase;
  const locked = document.getElementById('commandLocked');
  const app = document.getElementById('commandApp');
  const main = document.getElementById('commandMain');
  let currentRole = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function lock(title, lead) {
    document.getElementById('lockedTitle').textContent = title;
    document.getElementById('lockedLead').textContent = lead;
    locked.hidden = false;
    app.hidden = true;
  }

  if (!client) {
    lock('COMMAND is not yet connected.',
      'The Supabase backend has not been configured for this deployment. The command console activates with the commerce data model.');
    return;
  }

  async function count(table, filter) {
    let query = client.from(table).select('*', { count: 'exact', head: true });
    if (filter) query = filter(query);
    const { count: n, error } = await query;
    return error ? '—' : (n ?? 0);
  }

  const money = cents => '$' + (Number(cents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  // Pill tone per machine, so an operator reads state at a glance rather than
  // parsing three similar-looking words.
  const TONE = {
    // payment
    none: 'neutral', pending: 'warn', authorized: 'warn', captured: 'good',
    partially_refunded: 'warn', refunded: 'neutral', failed: 'bad',
    expired: 'bad', disputed: 'bad',
    // fulfillment
    unfulfilled: 'neutral', reserved: 'warn', processing: 'warn',
    ready: 'warn', partially_fulfilled: 'warn', fulfilled: 'good',
    // commercial
    confirmed: 'good', closed: 'neutral', cancelled: 'bad',
    // inventory
    ok: 'good', low: 'warn', out: 'bad',
    // inquiries
    new: 'warn', in_review: 'warn', answered: 'good'
  };
  const pill = value => `<span class="pill pill-${TONE[value] || 'neutral'}">${esc(String(value).replace(/_/g, ' '))}</span>`;

  const modules = {
    async dashboard() {
      // Revenue counts CAPTURED money only. Authorized-but-uncaptured is not
      // revenue, and showing it as such would overstate the business.
      const [orders, customers, low, newInquiries, captured, awaiting] = await Promise.all([
        count('orders'),
        count('profiles'),
        count('inventory', q => q.in('status', ['low', 'out'])),
        count('inquiries', q => q.eq('status', 'new')),
        client.from('orders').select('total_cents').eq('payment_status', 'captured')
          .then(({ data }) => (data || []).reduce((s, o) => s + Number(o.total_cents || 0), 0))
          .catch(() => 0),
        count('orders', q => q.eq('commercial_status', 'confirmed').in('fulfillment_status', ['unfulfilled', 'reserved', 'processing', 'ready']))
      ]);
      return `<div class="command-boundary" role="status">
          <strong>Controlled non-production environment</strong>
          <span>Commerce, payment collection, and live fulfillment are disabled.</span>
        </div>
        <h2>Overview</h2><p class="panel-sub">Operational snapshot — live from the dedicated Everlume preview data model.</p>
        <div class="stat-row">
          <div class="stat-tile"><b>${money(captured)}</b><span>Revenue (captured)</span></div>
          <div class="stat-tile"><b>${orders}</b><span>Orders</span></div>
          <div class="stat-tile"><b>${awaiting}</b><span>Awaiting fulfillment</span></div>
          <div class="stat-tile"><b>${customers}</b><span>Customers</span></div>
          <div class="stat-tile"><b>${newInquiries}</b><span>New inquiries</span></div>
          <div class="stat-tile"><b>${low}</b><span>Low / out of stock</span></div>
        </div>
        <p class="empty-note">Revenue reflects captured payments only — authorized-but-uncaptured amounts are not counted as revenue.</p>`;
    },
    async orders() {
      // Three independent machines per contract 01 / ruling D-1. They are shown
      // side by side because the combination is the operator's real signal:
      // captured + unfulfilled means "ready to pick", not "in progress".
      const { data } = await client.from('orders')
        .select('id, order_number, commercial_status, payment_status, fulfillment_status, total_cents, created_at, order_exceptions(reason, blocking, resolved_at)')
        .order('created_at', { ascending: false }).limit(40);
      const rows = data || [];
      if (!rows.length) return `<h2>Orders</h2><p class="panel-sub">Commercial · payment · fulfillment, tracked independently.</p><p class="empty-note">No orders in the system yet.</p>`;
      return `<h2>Orders</h2><p class="panel-sub">Commercial · payment · fulfillment, tracked independently.</p>
        <div class="data-list">${rows.map(o => {
          const open = (o.order_exceptions || []).filter(x => !x.resolved_at);
          const blocking = open.filter(x => x.blocking);
          return `<div class="row row-order">
            <div><strong>${esc(o.order_number || o.id.slice(0, 8))}</strong>
              <small>${esc(new Date(o.created_at).toLocaleString())} · ${money(o.total_cents)}</small>
              ${blocking.length ? `<small class="row-flag">⚠ ${blocking.length} blocking exception: ${esc(blocking.map(x => x.reason.replace(/_/g, ' ')).join(', '))}</small>` : ''}
            </div>
            <div class="pill-stack">
              <span class="pill-label">commercial</span>${pill(o.commercial_status)}
              <span class="pill-label">payment</span>${pill(o.payment_status)}
              <span class="pill-label">fulfillment</span>${pill(o.fulfillment_status)}
            </div>
          </div>`;
        }).join('')}</div>`;
    },

    async inquiries() {
      const { data } = await client.from('inquiries')
        .select('id, name, organization, email, product, message, status, created_at')
        .order('created_at', { ascending: false }).limit(40);
      const rows = data || [];
      return `<h2>Inquiries</h2><p class="panel-sub">Research and availability requests from the storefront.</p>` +
        (rows.length ? `<div class="data-list">${rows.map(q => `
          <div class="row"><div><strong>${esc(q.name || q.email)}</strong>
            <small>${esc(q.organization)} · ${esc(q.email)} · ${esc(new Date(q.created_at).toLocaleDateString())}</small>
            ${q.product ? `<small>Interested in: ${esc(q.product)}</small>` : ''}
            ${q.message ? `<small class="row-quote">${esc(q.message.slice(0, 160))}${q.message.length > 160 ? '…' : ''}</small>` : ''}
          </div>${pill(q.status)}</div>`).join('')}</div>`
          : '<p class="empty-note">No inquiries recorded yet. Storefront submissions land here once the inquiry form writes to the database.</p>');
    },
    async inventory() {
      const { data } = await client.from('inventory')
        .select('sku, quantity_on_hand, quantity_reserved, reorder_threshold, status, products(name, dose_label)')
        .order('sku');
      const rows = data || [];
      if (!rows.length) return `<h2>Inventory</h2><p class="panel-sub">Stock levels and reorder thresholds.</p><p class="empty-note">No inventory records yet.</p>`;
      const flagged = rows.filter(i => i.status !== 'ok').length;
      return `<h2>Inventory</h2>
        <p class="panel-sub">Stock, reorder thresholds, and audited manual adjustment.</p>
        ${flagged ? `<p class="ops-alert">${flagged} SKU${flagged > 1 ? 's are' : ' is'} at or below the reorder threshold.</p>` : ''}
        <div class="data-list">${rows.map(i => {
          const available = i.quantity_on_hand - i.quantity_reserved;
          return `<div class="row row-inv">
            <div><strong>${esc(i.products?.name || i.sku)} ${esc(i.products?.dose_label || '')}</strong>
              <small>${esc(i.sku)} · on hand ${i.quantity_on_hand} · reserved ${i.quantity_reserved} · <b>available ${available}</b> · reorder at ${i.reorder_threshold}</small>
            </div>
            <div class="inv-actions">
              ${pill(i.status)}
              ${['manager', 'admin'].includes(currentRole) ? `<button class="adjust-btn" data-sku="${esc(i.sku)}" type="button">Adjust</button>` : ''}
            </div>
          </div>`;
        }).join('')}</div>
        ${['manager', 'admin'].includes(currentRole) ? `<div class="adjust-panel" id="adjustPanel" hidden>
          <h3>Adjust stock — <span id="adjustSku"></span></h3>
          <p class="panel-sub">Manager or admin only. Every adjustment writes an audit record in the same transaction, so an adjustment that cannot be recorded does not happen.</p>
          <label>Change (+ / −)<input type="number" id="adjustDelta" step="1" placeholder="e.g. 12 or -3"></label>
          <label>Reason (required)<input type="text" id="adjustReason" placeholder="e.g. cycle count correction, receipt of PO 1042"></label>
          <div class="adjust-actions">
            <button class="btn btn-dark" id="adjustSubmit" type="button">Apply adjustment</button>
            <button class="request-btn" id="adjustCancel" type="button">Cancel</button>
          </div>
          <p class="pd-status" id="adjustStatus" role="status" aria-live="polite"></p>
        </div>` : '<p class="empty-note">Inventory adjustments require manager or administrator authorization.</p>'}`;
    },
    async customers() {
      const { data } = await client.from('profiles')
        .select('id, first_name, last_name, email, role, created_at, orders(total_cents, payment_status), rewards_accounts(balance)')
        .order('created_at', { ascending: false }).limit(30);
      const rows = data || [];
      if (!rows.length) return `<h2>Customers</h2><p class="panel-sub">Accounts, order history, and rewards.</p><p class="empty-note">No customer accounts yet.</p>`;
      return `<h2>Customers</h2><p class="panel-sub">Accounts, order history, and rewards.</p>
        <div class="data-list">${rows.map(p => {
          const orders = p.orders || [];
          const spent = orders.filter(o => o.payment_status === 'captured')
            .reduce((s, o) => s + Number(o.total_cents || 0), 0);
          const rewards = Array.isArray(p.rewards_accounts) ? p.rewards_accounts[0] : p.rewards_accounts;
          return `<div class="row">
            <div><strong>${esc([p.first_name, p.last_name].filter(Boolean).join(' ') || p.email)}</strong>
              <small>${esc(p.email)} · joined ${esc(new Date(p.created_at).toLocaleDateString())}</small>
              <small>${orders.length} order${orders.length === 1 ? '' : 's'} · ${money(spent)} captured · ${Number(rewards?.balance || 0).toLocaleString()} points</small>
            </div>${pill(p.role)}</div>`;
        }).join('')}</div>`;
    },
    async rewards() {
      const [accounts, outstanding] = await Promise.all([
        count('rewards_accounts'),
        client.from('rewards_accounts').select('balance').then(({ data }) =>
          (data || []).reduce((sum, r) => sum + Number(r.balance || 0), 0))
      ]);
      return `<h2>Rewards</h2><p class="panel-sub">Ledger-backed points program.</p>
        <div class="stat-row">
          <div class="stat-tile"><b>${accounts}</b><span>Accounts</span></div>
          <div class="stat-tile"><b>${outstanding.toLocaleString()}</b><span>Points outstanding</span></div>
        </div>
        <p class="empty-note">Earning rules live in rewards_rules and stay inactive until business rules are approved.</p>`;
    },
    async products() {
      const { data } = await client.from('products')
        .select('name, category, status, compliance_status').order('name');
      const rows = data || [];
      return `<h2>Products</h2><p class="panel-sub">Catalog, availability, and technical compliance state. A compliance_status of “approved” is an internal workflow state, not a declaration of legal or regulatory approval.</p>` +
        (rows.length ? `<div class="data-list">${rows.map(p => `
          <div class="row"><div>${esc(p.name)}<small>${esc(p.category)} · ${esc(p.status)}</small></div>
          <span class="pill">${esc(p.compliance_status)}</span></div>`).join('')}</div>`
        : '<p class="empty-note">No products in the database yet.</p>');
    },
    async compliance() {
      const { data } = await client.from('compliance_policies')
        .select('policy_type, version, title, active, effective_at').order('policy_type');
      const rows = data || [];
      const acceptances = await count('compliance_acceptances');
      return `<h2>Compliance</h2><p class="panel-sub">Policy versions and gate acceptances.</p>
        <div class="stat-row"><div class="stat-tile"><b>${acceptances}</b><span>Gate acceptances</span></div></div>` +
        (rows.length ? `<div class="data-list">${rows.map(p => `
          <div class="row"><div>${esc(p.title)}<small>${esc(p.policy_type)} · v${esc(p.version)}</small></div>
          <span class="pill">${p.active ? 'Active' : 'Inactive'}</span></div>`).join('')}</div>`
        : '<p class="empty-note">No policies recorded yet.</p>');
    },
    async analytics() {
      return `<h2>Analytics</h2><p class="panel-sub">Sales, AOV, repeat customers, inventory velocity.</p>
        <p class="empty-note">Analytics activates once real order flow exists — the schema already captures everything needed (orders, items, timestamps, customers).</p>`;
    },
    async activity() {
      const { data } = await client.from('audit_events')
        .select('action, entity_type, created_at, actor_id')
        .order('created_at', { ascending: false }).limit(40);
      const rows = data || [];
      return `<h2>Activity</h2><p class="panel-sub">Audit trail of protected admin actions.</p>` +
        (rows.length ? `<div class="data-list">${rows.map(e => `
          <div class="row"><div>${esc(e.action)}<small>${esc(e.entity_type)} · ${esc(new Date(e.created_at).toLocaleString())}</small></div></div>`).join('')}</div>`
        : '<p class="empty-note">No audit events yet.</p>');
    },
    async settings() {
      return `<h2>Settings</h2><p class="panel-sub">Store controls.</p>
        <p class="empty-note">Role management, gate versioning, and store configuration land here in the next phase. Roles are changed in the database by an admin — never from a hidden client control.</p>`;
    }
  };

  // Inventory adjustment goes through the adjust_inventory() function, never a
  // direct UPDATE: the function enforces the manager check, requires a reason,
  // refuses to drive stock negative, and writes the audit row transactionally.
  // The UI cannot weaken any of that — a hidden control is not a permission.
  function wireInventoryAdjust() {
    const panel = document.getElementById('adjustPanel');
    if (!panel) return;
    const skuLabel = document.getElementById('adjustSku');
    const delta = document.getElementById('adjustDelta');
    const reason = document.getElementById('adjustReason');
    const status = document.getElementById('adjustStatus');
    let activeSku = null;

    main.querySelectorAll('.adjust-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSku = btn.dataset.sku;
        skuLabel.textContent = activeSku;
        delta.value = '';
        reason.value = '';
        status.textContent = '';
        panel.hidden = false;
        panel.scrollIntoView({ block: 'nearest' });
        delta.focus();
      });
    });

    document.getElementById('adjustCancel').addEventListener('click', () => { panel.hidden = true; });

    document.getElementById('adjustSubmit').addEventListener('click', async () => {
      const d = parseInt(delta.value, 10);
      if (!Number.isFinite(d) || d === 0) { status.textContent = 'Enter a non-zero whole number.'; return; }
      if (!reason.value.trim()) { status.textContent = 'A reason is required.'; return; }
      status.textContent = 'Applying…';
      const { data, error } = await client.rpc('adjust_inventory', {
        p_sku: activeSku, p_delta: d, p_reason: reason.value.trim()
      });
      if (error) { status.textContent = error.message || 'Adjustment refused.'; return; }
      status.textContent = `Adjusted ${activeSku} to ${data?.quantity_on_hand ?? '—'} on hand. Audit record written.`;
      setTimeout(() => render('inventory'), 900);
    });
  }

  async function render(name) {
    main.innerHTML = '<p class="empty-note">Loading…</p>';
    try {
      main.innerHTML = await modules[name]();
      if (name === 'inventory') wireInventoryAdjust();
    } catch {
      main.innerHTML = '<p class="empty-note">Could not load this module.</p>';
    }
  }

  document.querySelectorAll('.command-nav button').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.command-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.module);
    }));

  (async function init() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { lock('Sign in required.', 'COMMAND is available to authorized Everlume staff only.'); return; }
    // Staff RLS can expose multiple profiles. Resolve only the authenticated
    // operator's row so authorization never depends on which other users exist.
    const { data: profile } = await client.from('profiles')
      .select('role, first_name, email')
      .eq('id', session.user.id)
      .maybeSingle();
    const role = profile?.role;
    if (!['staff', 'manager', 'admin'].includes(role)) {
      lock('Not authorized.', 'This console is restricted to Everlume staff. Your account does not have staff access.');
      return;
    }
    currentRole = role;
    document.getElementById('whoami').textContent = `${profile.first_name || profile.email} · ${role}`;
    locked.hidden = true;
    app.hidden = false;
    render('dashboard');
  })();
})();
