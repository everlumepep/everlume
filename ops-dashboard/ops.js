/* Everlume Operations Desk: authenticated, read-only Supabase control view. */
(function () {
  'use strict';

  const fixture = {
    mode: 'fixture', identity: null,
    control: [
      { label: 'Database', value: 'Fixture only', detail: 'Live Supabase connection unavailable', tone: 'neutral' },
      { label: 'Production release', value: 'Held', detail: 'Separate authorization required', tone: 'warn' },
      { label: 'Payments', value: 'Held', detail: 'Billing disabled', tone: 'warn' },
      { label: 'Inventory', value: 'Client input required', detail: 'No real quantities recorded', tone: 'warn' }
    ],
    orders: [], inventory: [], income: [], expenses: [], catalog: [], exceptions: [], handoffs: [], affiliates: [], commissions: [], audit: [],
    shipping: { provider: 'Shippo', plan: 'Starter', status: 'connected', labelFormat: '4 × 6 thermal', monthlyAllowance: 'Up to 30 labels' }
  };
  let data = fixture;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cash = value => Number(value || 0) / 100;
  const formatMoney = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
  const formatDate = value => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
  const pill = (value, tone = 'neutral') => `<span class="pill ${tone}">${esc(value)}</span>`;
  const safeLink = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? esc(url.href) : ''; } catch { return ''; } };
  const main = document.getElementById('main');
  const nav = Array.from(document.querySelectorAll('.nav-item'));
  const toast = document.getElementById('toast');
  const connectionState = document.getElementById('connectionState');
  const modeBadge = document.getElementById('modeBadge');
  const identity = document.getElementById('identity');
  const sidebarNote = document.getElementById('sidebarNote');

  function announce(message) {
    toast.textContent = message; toast.hidden = false;
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(() => { toast.hidden = true; }, 2800);
  }
  function header(kicker, title, description) {
    const live = data.mode === 'live';
    return `<div class="page-head"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="period-stack"><span class="period">${live ? 'Live operations' : 'Controlled fixture'}</span><span class="freshness">${live ? `Refreshed ${esc(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}` : 'No client records loaded'}</span></div></div>`;
  }
  function table(headers, rows, empty = 'No records yet.') {
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="empty-note">${esc(empty)}</td></tr>`}</tbody></table></div>`;
  }
  function tools() {
    return `<div class="table-tools"><label><span>Filter visible records</span><input class="table-search" type="search" placeholder="Search this view" autocomplete="off"></label><button class="export-action" type="button">Export visible CSV</button></div>`;
  }
  function overview() {
    const received = data.income.filter(row => row[3] === 'Captured').reduce((sum, row) => sum + cash(row[4]), 0);
    const available = data.inventory.reduce((sum, item) => sum + Math.max(0, item.on - item.res), 0);
    const openExceptions = data.exceptions.filter(row => row[3] !== 'Resolved').length;
    return header('Everlume Control View', 'What is true right now.', 'Live operational records are separated from release authority. No dashboard state enables commerce.') +
      `<section class="truth-panel"><div class="truth-heading"><div><p class="eyebrow">Current truth register</p><h2>Release posture</h2></div><span class="evidence-chip">Supabase · read only</span></div><div class="truth-grid">${data.control.map(item => `<article class="truth-card ${esc(item.tone)}"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.detail)}</small></article>`).join('')}</div></section>` +
      `<div class="section-intro"><div><p class="eyebrow">Operating pulse</p><h2>Live records</h2></div><p>Zero is a valid operational truth; it is never replaced with sample activity.</p></div>` +
      `<div class="metric-grid"><div class="metric"><span class="label">Captured receipts</span><span class="value">${formatMoney(received)}</span><span class="delta">From captured orders only</span></div><div class="metric"><span class="label">Orders</span><span class="value">${data.orders.length}</span><span class="delta">Current database rows</span></div><div class="metric"><span class="label">Available units</span><span class="value">${available}</span><span class="delta">Client count required</span></div><div class="metric"><span class="label">Open exceptions</span><span class="value">${openExceptions}</span><span class="delta">Unresolved records</span></div></div>` +
      `<div class="layout-2"><section class="panel"><h2>Decision queue</h2><p class="panel-sub">Remaining owner actions.</p><div class="decision-list"><div><span>01</span><div><strong>Enter real inventory</strong><small>Client supplies verified on-hand counts.</small></div></div><div><span>02</span><div><strong>Complete client access</strong><small>Create the Founder login and assign its governed role.</small></div></div><div><span>03</span><div><strong>Authorize production separately</strong><small>Commerce remains held after technical readiness.</small></div></div></div></section><section class="panel"><h2>Evidence health</h2><p class="panel-sub">Current system boundaries.</p><div class="health-list"><div><span>Live Supabase data</span>${pill(data.mode === 'live' ? 'Connected' : 'Not connected', data.mode === 'live' ? 'good' : 'neutral')}</div><div><span>Client pricing</span>${pill('Recorded', 'good')}</div><div><span>Inventory counts</span>${pill('Awaiting client', 'warn')}</div><div><span>Commerce release</span>${pill('Held', 'warn')}</div></div></section></div>`;
  }
  function orders() {
    return header('Module 02', 'Orders & preorders', 'Commercial, payment, and fulfillment states remain independent.') + tools() + table(['Reference', 'Date', 'Items', 'Commercial', 'Payment', 'Fulfillment'], data.orders.map(order => [esc(order.ref), esc(order.date), esc(order.item), pill(order.commercial, order.commercial === 'confirmed' ? 'good' : 'warn'), pill(order.payment, order.payment === 'captured' ? 'good' : 'neutral'), pill(order.fulfillment, order.fulfillment === 'fulfilled' ? 'good' : 'neutral')]), 'No real orders have been recorded.') + `<p class="footnote">Read-only view. State changes remain governed and audited.</p>`;
  }
  function inventory() {
    return header('Module 03', 'Inventory', 'Real quantities remain at zero until the client performs the first count.') + tools() + table(['SKU', 'Product / format', 'On hand', 'Reserved', 'Available', 'Status'], data.inventory.map(item => [`<strong>${esc(item.sku)}</strong>`, esc(item.name), item.on, item.res, Math.max(0, item.on - item.res), pill(item.status === 'out' ? 'Out of stock' : item.status === 'low' ? 'At threshold' : 'Healthy', item.status === 'out' ? 'bad' : item.status === 'low' ? 'warn' : 'good')]), 'No inventory records are visible.') + `<p class="footnote">Counts are never inferred from availability, pricing, screenshots, or supplier lists.</p>`;
  }
  function income() {
    return header('Module 04', 'Income', 'Only captured order totals are treated as received money.') + tools() + table(['Date', 'Reference', 'Amount', 'State'], data.income.map(row => [esc(row[0]), esc(row[1]), `<strong>${formatMoney(cash(row[4]))}</strong>`, pill(row[3], row[3] === 'Captured' ? 'good' : 'warn')]), 'No captured payments have been recorded.') + `<div class="callout" style="margin-top:18px">This view does not reconcile a bank account and cannot charge a card.</div>`;
  }
  function expenses() {
    return header('Module 05', 'Expenses', 'The current governed database does not yet include an expense ledger.') + `<section class="panel"><h2>No expense source connected</h2><p class="panel-sub">No fabricated expenses are shown. Add an approved accounting source before this module is activated.</p></section>`;
  }
  function catalog() {
    return header('Module 06', 'Catalog registry', 'Client-confirmed pricing is visible without implying inventory, compliance approval, or release authority.') + `<div class="callout" style="margin-bottom:18px"><strong>CLIENT REGISTER · COMMERCE HELD</strong><br>Semax is recorded at $30. Lipo C is recorded at $45. Real inventory remains client-owned.</div>` + tools() + table(['SKU', 'Material', 'Format', 'Price', 'Internal review'], data.catalog.map(row => [esc(row.sku), esc(row.name), esc(row.format || 'Format unverified'), row.price == null ? '—' : formatMoney(cash(row.price)), pill(row.compliance === 'approved' ? 'Approved' : 'Pending review', row.compliance === 'approved' ? 'good' : 'warn')]), 'No catalog records are visible.');
  }
  function exceptions() {
    return header('Module 07', 'Exceptions', 'Blocking conditions remain visible until an authorized person resolves them.') + tools() + table(['Type', 'Order', 'Detail', 'State'], data.exceptions.map(row => [esc(row[0]), `<strong>${esc(row[1])}</strong>`, esc(row[2]), pill(row[3], row[3] === 'Resolved' ? 'good' : 'warn')]), 'No order exceptions are open.');
  }
  function handoffs() {
    return header('Module 08', 'Handoffs & access', 'Business ownership and authenticated system access are recorded separately.') + `<div class="layout-2"><section class="panel"><p class="eyebrow">Business ownership</p><h2>Equal ownership</h2><div class="ownership-list"><div><span>DP</span><p><strong>Denisha Phillips</strong><small>Co-owner · 50%</small></p></div><div><span>VW</span><p><strong>Veronicah Williams</strong><small>Co-owner · 50%</small></p></div></div><div class="callout">The shared company service login is <strong>everlume.admin@gmail.com</strong>. Ownership does not automatically grant a separate system session.</div></section><section class="panel"><h2>Workspace access</h2><p class="panel-sub">Signed in as <strong>${esc(data.identity?.name || '—')}</strong> · ${esc(data.identity?.role || '—')}</p>` + table(['Name', 'Email', 'Role', 'Account'], data.handoffs.map(row => [esc(row.name), esc(row.email), pill(row.role, ['admin', 'manager'].includes(row.role) ? 'good' : 'neutral'), pill(row.status, row.status === 'active' ? 'good' : 'warn')]), 'No staff profiles have been created.') + `<div class="callout" style="margin-top:18px">Invitations, role changes, and account recovery remain deliberate administrative actions.</div></section></div>`;
  }
  function affiliates() {
    const canReview = ['manager', 'admin'].includes(data.identity?.role);
    const pendingTotal = data.commissions.filter(row => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
    return header('Module 09', 'Affiliate pilot', 'Applications are manually reviewed. Commission entries are pending estimates only; payouts are excluded.') +
      `<div class="metric-grid"><div class="metric"><span class="label">Applications</span><span class="value">${data.affiliates.length}</span><span class="delta">All pilot records</span></div><div class="metric"><span class="label">Pending estimates</span><span class="value">${formatMoney(cash(pendingTotal))}</span><span class="delta">Not a payable balance</span></div></div>` + tools() +
      table(['Applicant', 'Channel', 'Status', 'Code', 'Review'], data.affiliates.map(row => { const channel = safeLink(row.channel_url); return [esc(`${row.display_name} · ${row.email}`), channel ? `<a href="${channel}" rel="noopener noreferrer" target="_blank">Open link</a>` : '—', pill(row.status, row.status === 'approved' ? 'good' : row.status === 'declined' ? 'bad' : 'warn'), esc(row.affiliate_code || '—'), row.status === 'pending' && canReview ? `<button class="affiliate-review" data-id="${esc(row.id)}" data-decision="approved">Approve</button> <button class="affiliate-review" data-id="${esc(row.id)}" data-decision="declined">Decline</button>` : '—']; }), 'No affiliate applications have been submitted.') +
      `<div class="callout" style="margin-top:18px"><strong>Pilot boundary</strong><br>No payout, bank account, tax, tier, payable, or automated settlement capability is included.</div>`;
  }
  function shipping() {
    const connected = data.shipping?.status === 'connected';
    return header('Module 10', 'Shipping', 'Compare carriers and prepare thermal labels in the client-owned Shippo workspace.') +
      `<div class="metric-grid"><div class="metric"><span class="label">Provider</span><span class="value">${esc(data.shipping?.provider || 'Shippo')}</span><span class="delta">Multi-carrier workspace</span></div><div class="metric"><span class="label">Plan</span><span class="value">${esc(data.shipping?.plan || 'Starter')}</span><span class="delta">No monthly subscription fee</span></div><div class="metric"><span class="label">Workspace</span><span class="value">${connected ? 'Ready' : 'Pending'}</span><span class="delta">${connected ? 'Client-controlled account' : 'Owner setup not completed'}</span></div><div class="metric"><span class="label">Label format</span><span class="value">4 × 6</span><span class="delta">Thermal-printer ready</span></div></div>` +
      `<div class="layout-2"><section class="panel"><p class="eyebrow">Fulfillment workspace</p><h2>Shippo Starter</h2><p class="panel-sub">Compare available USPS, UPS, FedEx, and DHL rates, purchase postage, print labels, and follow tracking from one shipping workspace.</p><a class="shipping-launch" href="https://apps.goshippo.com/" target="_blank" rel="noopener noreferrer">Open Shippo securely <span aria-hidden="true">↗</span></a><p class="shipping-boundary">Postage and optional services are charged only when the authorized account owner purchases them in Shippo. This dashboard does not store a password or payment method.</p></section><section class="panel"><p class="eyebrow">Readiness</p><h2>${connected ? 'Manual workspace ready' : 'Account setup pending'}</h2><div class="health-list"><div><span>Monthly platform fee</span>${pill('$0', 'good')}</div><div><span>Starter allowance</span>${pill(esc(data.shipping?.monthlyAllowance || 'Up to 30 labels'), 'neutral')}</div><div><span>Thermal labels</span>${pill(esc(data.shipping?.labelFormat || '4 × 6 thermal'), 'good')}</div><div><span>API order sync</span>${pill('Not connected', 'neutral')}</div><div><span>Production fulfillment</span>${pill('Held', 'warn')}</div></div><div class="callout"><strong>Release boundary</strong><br>Creating the workspace does not approve products, inventory, destinations, postage purchases, or production commerce.</div></section></div>` +
      `<div class="layout-2"><section class="panel"><p class="eyebrow">Ready workflow</p><h2>Ship in four steps</h2><div class="decision-list"><div><span>01</span><div><strong>Verify the order</strong><small>Confirm the destination, approved inventory, and fulfillment status.</small></div></div><div><span>02</span><div><strong>Compare live rates</strong><small>Open Shippo and choose the authorized carrier and service.</small></div></div><div><span>03</span><div><strong>Buy and print the label</strong><small>Purchase postage in Shippo and print the 4 × 6 thermal label.</small></div></div><div><span>04</span><div><strong>Track the shipment</strong><small>Use Shippo as the tracking source until an approved API sync is added.</small></div></div></div></section><section class="panel"><p class="eyebrow">Local fulfillment</p><h2>Pickup or arranged drop-off</h2><p class="panel-sub">Checkout can collect a local postal code and preferred arrangement. Everlume confirms eligibility and details manually before fulfillment.</p><div class="health-list"><div><span>Checkout preference</span>${pill('Ready', 'good')}</div><div><span>Automatic mileage approval</span>${pill('Off', 'neutral')}</div><div><span>Owner confirmation</span>${pill('Required', 'warn')}</div></div><div class="callout"><strong>Before first shipment</strong><br>The owners must add and verify the sender/return address, phone number, and postage payment method inside Shippo.</div></section></div>`;
  }
  const views = { overview, orders, inventory, income, expenses, catalog, exceptions, handoffs, affiliates, shipping };
  function wireTools(view) {
    const search = main.querySelector('.table-search');
    if (search) search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      main.querySelectorAll('tbody tr').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query); });
    });
    const exportButton = main.querySelector('.export-action');
    if (exportButton) exportButton.addEventListener('click', () => {
      const rows = Array.from(main.querySelectorAll('table tr')).filter(row => !row.hidden).map(row => Array.from(row.cells).map(cell => `"${cell.textContent.trim().replaceAll('"', '""')}"`).join(','));
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `everlume-${view}-${data.mode}.csv`; link.click(); URL.revokeObjectURL(url);
      announce('Visible records exported locally.');
    });
  }
  function render(name) {
    nav.forEach(button => { const active = button.dataset.view === name; button.classList.toggle('active', active); button.setAttribute('aria-current', active ? 'page' : 'false'); });
    main.innerHTML = views[name](); wireTools(name);
    main.querySelectorAll('.affiliate-review').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      const { error } = await window.everlumeSupabase.rpc('review_affiliate_application', { p_application_id: button.dataset.id, p_decision: button.dataset.decision });
      if (error) { announce('Affiliate review could not be saved.'); button.disabled = false; return; }
      announce(`Affiliate application ${button.dataset.decision}.`); await connect(); render('affiliates');
    }));
    main.focus({ preventScroll: true });
  }
  function showAccess(title, message, action = '') {
    nav.forEach(button => { button.disabled = true; });
    main.innerHTML = `<section class="panel access-panel"><p class="eyebrow">Everlume Operations Desk</p><h1>${esc(title)}</h1><p>${esc(message)}</p>${action}</section>`;
  }
  async function connect() {
    const client = window.everlumeSupabase;
    if (!client) {
      connectionState.innerHTML = '<i aria-hidden="true"></i> Configuration required';
      modeBadge.textContent = 'CONTROLLED FIXTURE · NO CLIENT DATA';
      sidebarNote.innerHTML = '<strong>Offline fixture</strong><br>Supabase runtime configuration is absent. No client records are displayed.';
      render('overview'); return;
    }
    connectionState.innerHTML = '<i aria-hidden="true"></i> Connecting to Supabase';
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) {
      connectionState.innerHTML = '<i aria-hidden="true"></i> Sign-in required'; modeBadge.textContent = 'NO CLIENT DATA LOADED';
      showAccess('Sign in required', 'Use a governed Everlume staff account to open the live operations desk.', '<a class="btn" href="../account/signin.html?next=%2Fops-dashboard%2F">Open secure sign in</a>'); return;
    }
    const { data: profile, error: profileError } = await client.from('profiles').select('email,first_name,last_name,role,account_status').eq('id', session.user.id).single();
    if (profileError) throw profileError;
    if (!['staff', 'manager', 'admin'].includes(profile.role) || profile.account_status !== 'active') {
      showAccess('Access restricted', 'This account does not have an active Everlume operations role.'); return;
    }
    const [productsResult, inventoryResult, ordersResult, itemsResult, exceptionsResult, profilesResult, affiliateResult, commissionResult, auditResult] = await Promise.all([
      client.from('products').select('id,slug,name,dose_label,price_cents,status,compliance_status').order('name'),
      client.from('inventory').select('product_id,sku,quantity_on_hand,quantity_reserved,reorder_threshold,status,updated_at').order('sku'),
      client.from('orders').select('id,order_number,total_cents,currency,commercial_status,payment_status,fulfillment_status,created_at').order('created_at', { ascending: false }).limit(200),
      client.from('order_items').select('order_id,product_name,sku,quantity').limit(1000),
      client.from('order_exceptions').select('order_id,reason,detail,blocking,resolved_at,opened_at').order('opened_at', { ascending: false }).limit(200),
      client.from('profiles').select('email,first_name,last_name,role,account_status').order('first_name'),
      client.from('affiliate_applications').select('id,display_name,email,channel_url,status,affiliate_code,created_at').order('created_at', { ascending: false }),
      client.from('affiliate_commissions').select('affiliate_user_id,amount_cents,status,created_at').order('created_at', { ascending: false }),
      client.from('audit_events').select('action,entity_type,entity_id,created_at').order('created_at', { ascending: false }).limit(100)
    ]);
    const failures = [productsResult, inventoryResult, ordersResult, itemsResult, exceptionsResult, profilesResult, affiliateResult, commissionResult, auditResult].filter(result => result.error);
    if (failures.length) throw failures[0].error;
    const products = productsResult.data || [];
    const productById = new Map(products.map(product => [product.id, product]));
    const inventoryByProduct = new Map((inventoryResult.data || []).map(row => [row.product_id, row]));
    const itemsByOrder = new Map();
    (itemsResult.data || []).forEach(item => { const list = itemsByOrder.get(item.order_id) || []; list.push(`${item.sku || item.product_name} · ${item.quantity}`); itemsByOrder.set(item.order_id, list); });
    const orderNumberById = new Map((ordersResult.data || []).map(order => [order.id, order.order_number]));
    data = {
      mode: 'live', identity: { name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email, role: profile.role, email: profile.email },
      control: [
        { label: 'Database', value: 'Connected', detail: 'Authenticated Supabase read path', tone: 'good' },
        { label: 'Production release', value: 'Held', detail: 'Separate authorization required', tone: 'warn' },
        { label: 'Payments', value: 'Test readiness', detail: 'Production billing remains disabled', tone: 'warn' },
        { label: 'Inventory', value: 'Awaiting client count', detail: 'No quantities inferred', tone: 'warn' }
      ],
      orders: (ordersResult.data || []).map(order => ({ ref: order.order_number || order.id, date: formatDate(order.created_at), item: (itemsByOrder.get(order.id) || ['No line items']).join(', '), commercial: order.commercial_status, payment: order.payment_status, fulfillment: order.fulfillment_status, total: order.total_cents })),
      inventory: (inventoryResult.data || []).map(row => { const product = productById.get(row.product_id) || {}; return { sku: row.sku, name: `${product.name || 'Unknown'}${product.dose_label ? ` · ${product.dose_label}` : ''}`, on: row.quantity_on_hand, res: row.quantity_reserved, threshold: row.reorder_threshold, status: row.status }; }),
      income: (ordersResult.data || []).filter(order => order.payment_status === 'captured').map(order => [formatDate(order.created_at), order.order_number || order.id, order.currency, 'Captured', order.total_cents]),
      expenses: [],
      catalog: products.filter(product => product.status !== 'archived').map(product => { const stock = inventoryByProduct.get(product.id) || {}; return { sku: stock.sku || '—', name: product.name, format: product.dose_label, price: product.price_cents, compliance: product.compliance_status }; }),
      exceptions: (exceptionsResult.data || []).map(row => [row.reason, orderNumberById.get(row.order_id) || row.order_id, row.detail || (row.blocking ? 'Blocking' : 'Non-blocking'), row.resolved_at ? 'Resolved' : 'Open']),
      handoffs: (profilesResult.data || []).map(row => ({ name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—', email: row.email, role: row.role, status: row.account_status })),
      affiliates: affiliateResult.data || [],
      commissions: commissionResult.data || [],
      audit: (auditResult.data || []).map(row => [formatDate(row.created_at), row.action, row.entity_type, row.entity_id]),
      shipping: { provider: 'Shippo', plan: 'Starter', status: 'connected', labelFormat: '4 × 6 thermal', monthlyAllowance: 'Up to 30 labels' }
    };
    connectionState.innerHTML = '<i aria-hidden="true"></i> Live Supabase connected'; modeBadge.textContent = 'LIVE DATA · READ ONLY';
    identity.textContent = `${data.identity.name} · ${data.identity.role}`;
    sidebarNote.innerHTML = '<strong>Governed live view</strong><br>Records come from Supabase under row-level security. This desk cannot enable commerce or change inventory.';
    render('overview');
  }
  nav.forEach(button => button.addEventListener('click', () => render(button.dataset.view)));
  connect().catch(error => {
    console.error(error); connectionState.innerHTML = '<i aria-hidden="true"></i> Connection error'; modeBadge.textContent = 'NO CLIENT DATA LOADED';
    showAccess('Dashboard unavailable', 'The secure data connection could not be verified. No fallback client records were shown.');
  });
})();
