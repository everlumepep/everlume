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

  const modules = {
    async dashboard() {
      const [orders, customers, products, low] = await Promise.all([
        count('orders'), count('profiles'), count('products'),
        count('inventory', q => q.eq('status', 'low'))
      ]);
      return `<h2>Overview</h2><p class="panel-sub">Business snapshot — live from the shared data model.</p>
        <div class="stat-row">
          <div class="stat-tile"><b>${orders}</b><span>Orders</span></div>
          <div class="stat-tile"><b>${customers}</b><span>Customers</span></div>
          <div class="stat-tile"><b>${products}</b><span>Products</span></div>
          <div class="stat-tile"><b>${low}</b><span>Low stock</span></div>
        </div>
        <p class="empty-note">Module depth arrives with the commerce build-out; this console already reads the same source of truth as the storefront.</p>`;
    },
    async orders() {
      const { data } = await client.from('orders')
        .select('id, order_number, status, total_cents, created_at')
        .order('created_at', { ascending: false }).limit(30);
      const rows = data || [];
      return `<h2>Orders</h2><p class="panel-sub">Receive → process → fulfill → complete.</p>` +
        (rows.length ? `<div class="data-list">${rows.map(o => `
          <div class="row"><div>${esc(o.order_number || o.id.slice(0, 8))}<small>${esc(new Date(o.created_at).toLocaleString())} · $${(o.total_cents / 100).toFixed(2)}</small></div>
          <span class="pill">${esc(o.status)}</span></div>`).join('')}</div>`
        : '<p class="empty-note">No orders in the system yet.</p>');
    },
    async inventory() {
      const { data } = await client.from('inventory')
        .select('sku, quantity_on_hand, quantity_reserved, reorder_threshold, status, products(name)')
        .order('sku');
      const rows = data || [];
      return `<h2>Inventory</h2><p class="panel-sub">Stock levels and reorder thresholds.</p>` +
        (rows.length ? `<div class="data-list">${rows.map(i => `
          <div class="row"><div>${esc(i.products?.name || i.sku)}<small>${esc(i.sku)} · on hand ${i.quantity_on_hand} · reserved ${i.quantity_reserved} · reorder at ${i.reorder_threshold}</small></div>
          <span class="pill">${esc(i.status)}</span></div>`).join('')}</div>`
        : '<p class="empty-note">No inventory records yet.</p>');
    },
    async customers() {
      const { data } = await client.from('profiles')
        .select('id, first_name, last_name, email, role, created_at')
        .order('created_at', { ascending: false }).limit(30);
      const rows = data || [];
      return `<h2>Customers</h2><p class="panel-sub">Accounts on the platform.</p>` +
        (rows.length ? `<div class="data-list">${rows.map(p => `
          <div class="row"><div>${esc([p.first_name, p.last_name].filter(Boolean).join(' ') || p.email)}<small>${esc(p.email)} · joined ${esc(new Date(p.created_at).toLocaleDateString())}</small></div>
          <span class="pill">${esc(p.role)}</span></div>`).join('')}</div>`
        : '<p class="empty-note">No customer accounts yet.</p>');
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

  async function render(name) {
    main.innerHTML = '<p class="empty-note">Loading…</p>';
    try { main.innerHTML = await modules[name](); }
    catch { main.innerHTML = '<p class="empty-note">Could not load this module.</p>'; }
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
    const { data: profile } = await client.from('profiles').select('role, first_name, email').maybeSingle();
    const role = profile?.role;
    if (!['staff', 'manager', 'admin'].includes(role)) {
      lock('Not authorized.', 'This console is restricted to Everlume staff. Your account does not have staff access.');
      return;
    }
    document.getElementById('whoami').textContent = `${profile.first_name || profile.email} · ${role}`;
    locked.hidden = true;
    app.hidden = false;
    render('dashboard');
  })();
})();
