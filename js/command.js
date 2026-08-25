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
  const nav = document.querySelector('.command-nav');
  const navButtons = Array.from(document.querySelectorAll('.command-nav button'));
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

  const compactMoney = cents => '$' + (Number(cents || 0) / 100).toLocaleString(undefined, {
    maximumFractionDigits: 0
  });

  const dayKey = date => new Date(date).toISOString().slice(0, 10);
  const shortDay = date => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const relativeDelta = (current, previous) => {
    if (!previous) return current ? 'New activity' : 'No change';
    const value = Math.round(((current - previous) / previous) * 100);
    return `${value > 0 ? '+' : ''}${value}% vs prior 7 days`;
  };

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
      const now = new Date();
      const start30 = new Date(now); start30.setDate(start30.getDate() - 30);
      const start14 = new Date(now); start14.setDate(start14.getDate() - 13); start14.setHours(0, 0, 0, 0);
      const start7 = new Date(now); start7.setDate(start7.getDate() - 7);
      const startPrior7 = new Date(now); startPrior7.setDate(startPrior7.getDate() - 14);

      const [orderResult, customers, inventoryResult, newInquiries, complianceResult] = await Promise.all([
        client.from('orders')
          .select('id, order_number, commercial_status, payment_status, fulfillment_status, total_cents, created_at')
          .gte('created_at', start30.toISOString())
          .order('created_at', { ascending: false }),
        count('profiles'),
        client.from('inventory').select('status, quantity_on_hand, quantity_reserved'),
        count('inquiries', q => q.eq('status', 'new')),
        client.from('products').select('status, compliance_status')
      ]);
      const orders = orderResult.data || [];
      const inventory = inventoryResult.data || [];
      const products = complianceResult.data || [];
      const capturedOrders = orders.filter(o => o.payment_status === 'captured');
      const captured = capturedOrders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
      const awaiting = orders.filter(o => o.commercial_status === 'confirmed' && ['unfulfilled', 'reserved', 'processing', 'ready'].includes(o.fulfillment_status)).length;
      const low = inventory.filter(item => ['low', 'out'].includes(item.status)).length;
      const availableUnits = inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity_on_hand || 0) - Number(item.quantity_reserved || 0)), 0);
      const pendingCompliance = products.filter(product => product.compliance_status !== 'approved').length;
      const current7 = orders.filter(o => new Date(o.created_at) >= start7).length;
      const prior7 = orders.filter(o => new Date(o.created_at) >= startPrior7 && new Date(o.created_at) < start7).length;
      const aov = capturedOrders.length ? Math.round(captured / capturedOrders.length) : 0;
      const days = Array.from({ length: 14 }, (_, index) => {
        const date = new Date(start14); date.setDate(date.getDate() + index);
        const key = dayKey(date);
        const dayOrders = orders.filter(order => dayKey(order.created_at) === key);
        return { date, count: dayOrders.length, revenue: dayOrders.filter(order => order.payment_status === 'captured').reduce((sum, order) => sum + Number(order.total_cents || 0), 0) };
      });
      const maxDaily = Math.max(1, ...days.map(day => day.count));
      const latest = orders.slice(0, 5);
      const readiness = [
        { label: 'Inventory available', value: availableUnits > 0 ? `${availableUnits} units` : 'Blocked', tone: availableUnits > 0 ? 'good' : 'bad' },
        { label: 'Product compliance', value: pendingCompliance ? `${pendingCompliance} pending` : 'Clear', tone: pendingCompliance ? 'warn' : 'good' },
        { label: 'Fulfillment queue', value: awaiting ? `${awaiting} open` : 'Clear', tone: awaiting ? 'warn' : 'good' },
        { label: 'New inquiries', value: Number(newInquiries) ? `${newInquiries} waiting` : 'Clear', tone: Number(newInquiries) ? 'warn' : 'good' }
      ];

      return `<div class="command-heading">
          <div><p class="command-kicker">Everlume operating view</p><h2>Business overview</h2><p class="panel-sub">Thirty-day performance, current operational risk, and the work requiring attention.</p></div>
          <div class="freshness"><span class="live-dot"></span>Live from Supabase<small>Updated ${esc(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</small></div>
        </div>
        <div class="command-kpis">
          <article class="command-kpi command-kpi-primary"><span>Captured revenue · 30 days</span><b>${money(captured)}</b><small>${capturedOrders.length} captured payment${capturedOrders.length === 1 ? '' : 's'}</small></article>
          <article class="command-kpi"><span>Orders · 30 days</span><b>${orders.length}</b><small>${esc(relativeDelta(current7, prior7))}</small></article>
          <article class="command-kpi"><span>Average order value</span><b>${money(aov)}</b><small>Captured orders only</small></article>
          <article class="command-kpi"><span>Customers</span><b>${customers}</b><small>Registered profiles</small></article>
        </div>
        <div class="command-grid">
          <section class="command-card command-chart-card">
            <div class="card-heading"><div><span>Order movement</span><h3>Last 14 days</h3></div><small>${current7} orders in the latest 7 days</small></div>
            <div class="mini-chart" aria-label="Orders by day for the last fourteen days">${days.map(day => `<div class="mini-day" title="${esc(shortDay(day.date))}: ${day.count} orders, ${compactMoney(day.revenue)} captured"><div class="mini-bar-wrap"><span class="mini-bar" style="height:${Math.max(day.count ? 10 : 2, Math.round((day.count / maxDaily) * 100))}%"></span></div><small>${esc(day.date.toLocaleDateString(undefined, { weekday: 'narrow' }))}</small></div>`).join('')}</div>
            <div class="chart-legend"><span><i></i>Order count</span><span>Hover bars for daily captured revenue</span></div>
          </section>
          <section class="command-card command-readiness">
            <div class="card-heading"><div><span>Release posture</span><h3>Operating readiness</h3></div></div>
            <div class="readiness-list">${readiness.map(item => `<div><span>${esc(item.label)}</span><strong class="readiness-${item.tone}">${esc(item.value)}</strong></div>`).join('')}</div>
            <p>Production commerce remains controlled separately from this dashboard.</p>
          </section>
        </div>
        <section class="command-card command-recent">
          <div class="card-heading"><div><span>Current flow</span><h3>Recent orders</h3></div><small>${awaiting} awaiting fulfillment</small></div>
          ${latest.length ? `<div class="data-list">${latest.map(order => `<div class="row row-order"><div><strong>${esc(order.order_number || order.id.slice(0, 8))}</strong><small>${esc(new Date(order.created_at).toLocaleString())} · ${money(order.total_cents)}</small></div><div class="pill-stack"><span class="pill-label">payment</span>${pill(order.payment_status)}<span class="pill-label">fulfillment</span>${pill(order.fulfillment_status)}</div></div>`).join('')}</div>` : '<p class="empty-note">No orders recorded in the last 30 days.</p>'}
        </section>
        <p class="metric-note">Revenue includes captured payments only. Order, inventory, customer, inquiry, and compliance values are read directly from their respective Supabase tables; unavailable sources display an em dash rather than sample data.</p>`;
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
              <button class="adjust-btn" data-sku="${esc(i.sku)}" type="button">Adjust</button>
            </div>
          </div>`;
        }).join('')}</div>
        <div class="adjust-panel" id="adjustPanel" hidden>
          <h3>Adjust stock — <span id="adjustSku"></span></h3>
          <p class="panel-sub">Manager or admin only. Every adjustment writes an audit record in the same transaction, so an adjustment that cannot be recorded does not happen.</p>
          <label>Change (+ / −)<input type="number" id="adjustDelta" step="1" placeholder="e.g. 12 or -3"></label>
          <label>Reason (required)<input type="text" id="adjustReason" placeholder="e.g. cycle count correction, receipt of PO 1042"></label>
          <div class="adjust-actions">
            <button class="btn btn-dark" id="adjustSubmit" type="button">Apply adjustment</button>
            <button class="request-btn" id="adjustCancel" type="button">Cancel</button>
          </div>
          <p class="pd-status" id="adjustStatus" role="status" aria-live="polite"></p>
        </div>`;
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

  function setActiveNav(button, focus = false) {
    const module = button.dataset.module;
    navButtons.forEach(btn => {
      const active = btn === button;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
      btn.setAttribute('tabindex', active ? '0' : '-1');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', 'commandMain');
    });
    if (nav) nav.setAttribute('role', 'tablist');
    main.setAttribute('role', 'tabpanel');
    render(module);
    if (focus) button.focus();
  }

  function onNavKeydown(event, index) {
    const max = navButtons.length;
    if (!max) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % max;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + max) % max;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = max - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setActiveNav(navButtons[nextIndex], true);
  }

  navButtons.forEach((btn, index) => {
    btn.id = btn.id || `commandNav-${btn.dataset.module}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', 'commandMain');
    btn.setAttribute('tabindex', index === 0 ? '0' : '-1');
    btn.setAttribute('aria-selected', String(index === 0));
    btn.addEventListener('click', () => setActiveNav(btn));
    btn.addEventListener('keydown', event => onNavKeydown(event, index));
  });
  if (nav) nav.setAttribute('role', 'tablist');
  main.setAttribute('tabindex', '0');
  main.setAttribute('role', 'tabpanel');

  (async function init() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { lock('Sign in required.', 'COMMAND is available to authorized Everlume staff only.'); return; }
    // Staff can read more than one profile through RLS. Always scope the
    // identity lookup to the authenticated user's row so maybeSingle cannot
    // fail as soon as another customer exists.
    const { data: profile } = await client.from('profiles')
      .select('role, first_name, email')
      .eq('id', session.user.id)
      .maybeSingle();
    const role = profile?.role;
    if (!['staff', 'manager', 'admin'].includes(role)) {
      lock('Not authorized.', 'This console is restricted to Everlume staff. Your account does not have staff access.');
      return;
    }
    document.getElementById('whoami').textContent = `${profile.first_name || profile.email} · ${role}`;
    locked.hidden = true;
    app.hidden = false;
    const initial = navButtons.find(button => button.dataset.module === 'dashboard') || navButtons[0];
    if (initial) setActiveNav(initial);
    else render('dashboard');
  })();
})();
