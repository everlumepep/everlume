// My Everlume customer portal. All reads go through RLS-protected tables, so
// a signed-in customer can only ever see their own rows.
(function () {
  const client = window.everlumeSupabase;
  const app = document.getElementById('accountApp');
  const fallback = document.getElementById('accountFallback');
  const panel = document.getElementById('accountPanel');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function showFallback(title, lead) {
    document.getElementById('fallbackTitle').textContent = title;
    document.getElementById('fallbackLead').textContent = lead;
    fallback.hidden = false;
    app.hidden = true;
  }

  if (!client) {
    showFallback('Accounts are coming soon.',
      'The Everlume account backend has not been connected on this preview yet.');
    return;
  }

  let user = null;
  let profile = null;

  const money = cents => '$' + (Number(cents || 0) / 100).toFixed(2);
  const when = iso => iso ? new Date(iso).toLocaleDateString() : '—';

  async function loadOrders() {
    const { data } = await client.from('orders')
      .select('id, order_number, status, total_cents, created_at, order_items(quantity, product_name)')
      .order('created_at', { ascending: false }).limit(25);
    return data || [];
  }

  async function loadRewards() {
    const [{ data: account }, { data: txns }] = await Promise.all([
      client.from('rewards_accounts').select('*').maybeSingle(),
      client.from('rewards_transactions').select('*').order('created_at', { ascending: false }).limit(50)
    ]);
    return { account, txns: txns || [] };
  }

  const sections = {
    async overview() {
      const [orders, rewards] = await Promise.all([loadOrders(), loadRewards()]);
      const balance = rewards.account?.balance ?? 0;
      return `
        <h2>Welcome${profile?.first_name ? ', ' + esc(profile.first_name) : ''}.</h2>
        <p class="panel-sub">Your Everlume account at a glance.</p>
        <div class="stat-row">
          <div class="stat-tile"><b>${orders.length}</b><span>Orders</span></div>
          <div class="stat-tile"><b>${Number(balance).toLocaleString()}</b><span>Reward points</span></div>
          <div class="stat-tile"><b>${esc(when(user.created_at))}</b><span>Member since</span></div>
        </div>
        ${orders.length ? `<div class="data-list">${orders.slice(0, 5).map(o => `
          <div class="row"><div>${esc(o.order_number || o.id.slice(0, 8))}<small>${esc(when(o.created_at))} · ${money(o.total_cents)}</small></div>
          <span class="pill">${esc(o.status)}</span></div>`).join('')}</div>`
        : '<p class="empty-note">No orders yet. Once ordering opens, your purchases will appear here.</p>'}`;
    },
    async orders() {
      const orders = await loadOrders();
      return `<h2>Orders</h2><p class="panel-sub">Every order placed with this account.</p>` +
        (orders.length ? `<div class="data-list">${orders.map(o => `
          <div class="row"><div>${esc(o.order_number || o.id.slice(0, 8))}
            <small>${esc(when(o.created_at))} · ${(o.order_items || []).map(i => esc(`${i.quantity}× ${i.product_name}`)).join(', ') || 'No line items'} · ${money(o.total_cents)}</small></div>
          <span class="pill">${esc(o.status)}</span></div>`).join('')}</div>`
        : '<p class="empty-note">No orders yet.</p>');
    },
    async rewards() {
      const { account, txns } = await loadRewards();
      return `<h2>Rewards</h2><p class="panel-sub">Points are recorded as a ledger — every earn and redemption is listed.</p>
        <div class="stat-row"><div class="stat-tile"><b>${Number(account?.balance ?? 0).toLocaleString()}</b><span>Available points</span></div>
        <div class="stat-tile"><b>${esc(account?.referral_code || '—')}</b><span>Referral code</span></div></div>` +
        (txns.length ? `<div class="data-list">${txns.map(t => `
          <div class="row"><div>${esc(t.description || t.type)}<small>${esc(when(t.created_at))} · ${esc(t.type)}</small></div>
          <span class="pill">${t.points > 0 ? '+' : ''}${Number(t.points).toLocaleString()}</span></div>`).join('')}</div>`
        : '<p class="empty-note">No rewards activity yet. The rewards program will activate once business rules are approved.</p>');
    },
    async profile() {
      return `<h2>Profile</h2><p class="panel-sub">Your account information.</p>
        <form id="profileForm" class="portal-card" style="box-shadow:none;border:0;padding:0;width:100%">
          <label>First name<input name="first_name" value="${esc(profile?.first_name)}" autocomplete="given-name"></label>
          <label>Last name<input name="last_name" value="${esc(profile?.last_name)}" autocomplete="family-name"></label>
          <label>Phone<input name="phone" value="${esc(profile?.phone)}" autocomplete="tel"></label>
          <label class="gate-check" style="text-transform:none;letter-spacing:0"><input type="checkbox" name="marketing_opt_in" ${profile?.marketing_opt_in ? 'checked' : ''}> Send me occasional Everlume updates.</label>
          <p class="form-status" id="profileStatus" role="status" aria-live="polite"></p>
          <button class="btn btn-dark" type="submit">Save profile</button>
        </form>`;
    },
    async addresses() {
      const { data } = await client.from('addresses').select('*').order('created_at');
      const rows = data || [];
      return `<h2>Addresses</h2><p class="panel-sub">Saved shipping addresses.</p>` +
        (rows.length ? `<div class="data-list">${rows.map(a => `
          <div class="row"><div>${esc(a.label || 'Address')}<small>${esc([a.line1, a.line2, a.city, a.region, a.postal_code, a.country].filter(Boolean).join(', '))}</small></div>
          ${a.is_default ? '<span class="pill">Default</span>' : ''}</div>`).join('')}</div>`
        : '<p class="empty-note">No saved addresses yet. Address management opens with checkout.</p>');
    },
    async settings() {
      return `<h2>Settings</h2><p class="panel-sub">Account controls.</p>
        <div class="data-list">
          <div class="row"><div>Email<small>${esc(user.email)}</small></div><span class="pill">Verified</span></div>
          <div class="row"><div>Password<small>Use “Forgot password” on the sign-in page to change it.</small></div></div>
        </div>
        <p class="empty-note">Need help or want to close your account? Contact Everlume through the inquiry form.</p>`;
    }
  };

  async function render(name) {
    panel.innerHTML = '<p class="empty-note">Loading…</p>';
    try { panel.innerHTML = await sections[name](); }
    catch { panel.innerHTML = '<p class="empty-note">We could not load this section. Please refresh.</p>'; }
    if (name === 'profile') bindProfileForm();
  }

  function bindProfileForm() {
    const form = document.getElementById('profileForm');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const status = document.getElementById('profileStatus');
      const { error } = await client.from('profiles').update({
        first_name: data.get('first_name'),
        last_name: data.get('last_name'),
        phone: data.get('phone'),
        marketing_opt_in: data.get('marketing_opt_in') === 'on'
      }).eq('id', user.id);
      status.textContent = error ? 'We could not save your profile.' : 'Profile saved.';
      if (!error) { const { data: p } = await client.from('profiles').select('*').maybeSingle(); profile = p; }
    });
  }

  document.querySelectorAll('.account-nav button').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.account-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.section);
    }));

  document.getElementById('signOutBtn').addEventListener('click', async event => {
    event.preventDefault();
    await client.auth.signOut();
    location.href = 'signin.html';
  });

  (async function init() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { location.replace('signin.html'); return; }
    user = session.user;
    const { data: p } = await client.from('profiles').select('*').maybeSingle();
    profile = p;
    fallback.hidden = true;
    app.hidden = false;
    render('overview');
  })();
})();
