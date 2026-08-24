/* Everlume Operations Desk: fabricated fixture only. No network, storage, or writes. */
(function(){
  'use strict';
  const data={
    orders:[
      {ref:'SYN-1042',date:'Aug 24',item:'EL-TR20 · 2',status:'Preorder',owner:'Denesha',due:'Aug 28'},
      {ref:'SYN-1041',date:'Aug 23',item:'EL-RT10 · 1',status:'Review',owner:'Karon',due:'Aug 26'},
      {ref:'SYN-1039',date:'Aug 21',item:'EL-NAD1000 · 3',status:'Awaiting owner',owner:'—',due:'—'}
    ],
    inventory:[
      {sku:'EL-TR20',name:'Tirzepatide · 20mg',on:9,res:2,threshold:5,status:'good',count:'Aug 24'},
      {sku:'EL-RT20',name:'Retatrutide · 20mg',on:8,res:0,threshold:5,status:'good',count:'Aug 24'},
      {sku:'EL-TR10',name:'Tirzepatide · 10mg',on:5,res:0,threshold:5,status:'warn',count:'Aug 23'},
      {sku:'EL-NAD1000',name:'NAD+ · 1000mg',on:0,res:0,threshold:5,status:'bad',count:'Aug 12'}
    ],
    income:[['Aug 24','SYN-1042','$300','Expected'],['Aug 23','SYN-1041','$165','Received'],['Aug 21','SYN-1039','$320','Received']],
    expenses:[['Aug 23','Shipping materials','$14','Reviewed'],['Aug 22','Advertising','$20','Reviewed'],['Aug 18','Supplies','$100','Needs receipt']],
    catalog:[['EL-TR10','Tirzepatide','10mg','Client draft'],['EL-TR20','Tirzepatide','20mg','$65 · draft'],['EL-RT10','Retatrutide','10mg','$60 · draft'],['EL-TSM10','Tesamorelin','10mg','Client draft'],['EL-NAD1000','NAD+','1000mg','$95 · draft']],
    exceptions:[['Low stock','EL-TR10','Medium','Open'],['Stale count','EL-NAD1000','High','Open'],['Missing owner','SYN-1039','High','Open'],['Duplicate reference','SYN-1037','Low','Resolved']],
    handoffs:[['Denesha','Karon','Order review · SYN-1041','Requested'],['Karon','Denesha','Inventory count · Aug 28','Accepted']],
    audit:[['12:04','fixture.loaded','EVD-SYN-20260824','System'],['12:05','view.reviewed','overview','Owner']]
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=s=>esc(s);
  const pill=(s,tone)=>`<span class="pill ${tone||'neutral'}">${esc(s)}</span>`;
  const main=document.getElementById('main');
  const nav=Array.from(document.querySelectorAll('.nav-item'));
  const toast=document.getElementById('toast');
  const role=()=>document.getElementById('roleSelect').value;
  const cash=s=>Number(String(s).replace(/[^0-9.-]/g,''))||0;
  const received=data.income.filter(r=>r[3]==='Received').reduce((n,r)=>n+cash(r[2]),0);
  const expensesTotal=data.expenses.reduce((n,r)=>n+cash(r[2]),0);
  const available=data.inventory.reduce((n,i)=>n+Math.max(0,i.on-i.res),0);
  const openExceptions=data.exceptions.filter(r=>r[3]!=='Resolved').length;
  const formatMoney=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  function announce(message){toast.textContent=message;toast.hidden=false;window.clearTimeout(announce.timer);announce.timer=window.setTimeout(()=>{toast.hidden=true},2800)}
  function header(kicker,title,desc){return `<div class="page-head"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="period-stack"><span class="period">Synthetic period · Aug 2026</span><span class="freshness">Observed Aug 24 · fixture current</span></div></div>`}
  function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function tools(){return `<div class="table-tools"><label><span>Filter visible records</span><input class="table-search" type="search" placeholder="Search this view" autocomplete="off"></label><button class="export-action" type="button">Export synthetic CSV</button></div>`}
  function overview(){return header('Everlume Operations Desk','Good morning, Denesha.','A calm view of what needs attention today. Every figure below is derived from fabricated source records for local workflow review.')+`<div class="metric-grid"><div class="metric"><span class="label">Received this month</span><span class="value">${formatMoney(received)}</span><span class="delta">2 received records</span></div><div class="metric"><span class="label">Tracked expenses</span><span class="value">${formatMoney(expensesTotal)}</span><span class="delta">3 entries · 1 needs receipt</span></div><div class="metric"><span class="label">Available units</span><span class="value">${available}</span><span class="delta">1 item at threshold</span></div><div class="metric"><span class="label">Open exceptions</span><span class="value">${openExceptions}</span><span class="delta">2 high priority</span></div></div><div class="layout-2"><section class="panel"><h2>Today’s queue</h2><p class="panel-sub">The next decisions, not a wall of data.</p><div class="list">${data.orders.map(o=>`<div class="list-row"><div><strong>${esc(o.ref)} · ${esc(o.item)}</strong><small>${esc(o.date)} · due ${esc(o.due)} · owner ${esc(o.owner)}</small></div>${pill(o.status,o.status==='Awaiting owner'?'bad':'warn')}</div>`).join('')}</div></section><section class="panel"><h2>Source health</h2><p class="panel-sub">No connected sources in this preview.</p><div class="health-list"><div><span>Fixture integrity</span>${pill('Verified','good')}</div><div><span>Client data</span>${pill('Disconnected','neutral')}</div><div><span>Commerce</span>${pill('Blocked','warn')}</div></div><div class="callout"><strong>LOCAL SYNTHETIC MODE</strong><br>Metrics are derived from fabricated records in this browser session. A future connected source must identify freshness and ownership before it can become operational truth.</div><p class="footnote">Source refs: <code>fixture.orders</code>, <code>fixture.inventory_snapshot</code>, <code>fixture.income</code></p></section></div>`}
  function orders(){return header('Module 02','Orders & preorders','Track the promise, owner, and due date without pretending a request is fulfilled.')+tools()+table(['Reference','Date','Item / quantity','Status','Owner','Due'],data.orders.map(o=>[esc(o.ref),esc(o.date),esc(o.item),pill(o.status,o.status==='Awaiting owner'?'bad':'warn'),esc(o.owner),esc(o.due)]))+`<p class="footnote">Read-only preview · no order status can be changed here.</p>`}
  function inventory(){return header('Module 03','Inventory','See what is available, what is reserved, and what needs a count.')+tools()+table(['SKU','Product / format','On hand','Reserved','Available','Counted','Status'],data.inventory.map(i=>[`<strong>${esc(i.sku)}</strong>`,esc(i.name),i.on,i.res,i.on-i.res,esc(i.count),pill(i.status==='bad'?'Out of stock':i.status==='warn'?'At threshold':'Healthy',i.status)]))+`<p class="footnote">Source refs: <code>fixture.inventory_snapshot</code> · negative available stock is blocked and flagged.</p>`}
  function income(){return header('Module 04','Income','Separate received money from expected money. No payment processor is connected.')+tools()+table(['Date','Reference','Amount','State'],data.income.map(r=>[...r.slice(0,2).map(esc),`<strong>${esc(r[2])}</strong>`,pill(r[3],r[3]==='Received'?'good':'warn')]))+`<div class="callout" style="margin-top:18px">This view is a recordkeeping tool only. It does not charge cards, reconcile a bank, or activate affiliate payouts.</div>`}
  function expenses(){return header('Module 05','Expenses','Capture operating costs with a simple review state and receipt reference.')+tools()+table(['Date','Category','Amount','Review state'],data.expenses.map(r=>[...r.slice(0,2).map(esc),`<strong>${esc(r[2])}</strong>`,pill(r[3],r[3]==='Reviewed'?'good':'warn')]))+`<p class="footnote">Receipt files and payment credentials are excluded from this synthetic prototype.</p>`}
  function catalog(){return header('Module 06','Catalog registry','A controlled place to reconcile client-proposed names, codes, formats, and prices.')+`<div class="callout" style="margin-bottom:18px"><strong>CLIENT DRAFT · PENDING AUDIT</strong><br>This register preserves the supplied convention for review. It does not approve products, publish prices, or open a purchase path.</div>`+tools()+table(['SKU','Material','Format','State'],data.catalog.map(r=>[...r.slice(0,3).map(esc),pill(r[3],r[3].includes('$')?'warn':'neutral')]))+`<p class="footnote">Source refs: <code>fixture.catalog_registry</code> · final canonical values require client and Founder review.</p>`}
  function exceptions(){return header('Module 07','Exceptions','A small queue prevents missing data from becoming invisible work.')+tools()+table(['Type','Record','Severity','State'],data.exceptions.map(r=>[esc(r[0]),`<strong>${esc(r[1])}</strong>`,pill(r[2],r[2]==='High'?'bad':r[2]==='Medium'?'warn':'neutral'),pill(r[3],r[3]==='Resolved'?'good':'warn')]))+`<p class="footnote">No automatic reassignment, purchasing, messaging, or closure occurs in this preview.</p>`}
  function handoffs(){return header('Module 08','Handoffs & access','Two people can share work without silently transferring ownership.')+`<section class="panel"><h2>Workspace access</h2><p class="panel-sub">Current view: <strong id="roleCopy">Owner</strong>. Roles are illustrative and enforced only by a future connected backend.</p><div class="list">${data.handoffs.map(h=>`<div class="handoff"><span class="avatar" aria-hidden="true">${esc(h[0][0]+h[1][0])}</span><div style="flex:1"><strong>${esc(h[2])}</strong><small>${esc(h[0])} → ${esc(h[1])}</small></div>${pill(h[3],h[3]==='Accepted'?'good':'warn')}</div>`).join('')}</div><div class="callout" style="margin-top:18px">A joint decision remains pending until both required partners explicitly confirm. This preview has no write-back or invitation capability.</div><button class="disabled-action" type="button" disabled aria-disabled="true" title="Disabled in synthetic preview">Invite or change access (disabled)</button></section>`}
  const views={overview,orders,inventory,income,expenses,catalog,exceptions,handoffs};
  function wireTools(view){
    const search=main.querySelector('.table-search');
    if(search)search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();main.querySelectorAll('tbody tr').forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(q)});});
    const exportButton=main.querySelector('.export-action');
    if(exportButton){
      const denied=role()==='reviewer';
      exportButton.disabled=denied;
      exportButton.setAttribute('aria-disabled',String(denied));
      if(denied)exportButton.title='Reviewer export requires separate permission';
      exportButton.addEventListener('click',()=>{
        if(role()==='reviewer')return announce('Reviewer export is blocked pending separate permission.');
        const rows=Array.from(main.querySelectorAll('table tr')).filter(row=>!row.hidden).map(row=>Array.from(row.cells).map(cell=>`"${cell.textContent.trim().replaceAll('"','""')}"`).join(','));
        const blob=new Blob([rows.join('\n')],{type:'text/csv'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`everlume-${view}-synthetic.csv`;link.click();URL.revokeObjectURL(url);
        data.audit.push([new Date().toISOString().slice(11,16),'synthetic.export',view,role()]);announce('Synthetic CSV prepared. No client or provider data was accessed.');
      });
    }
  }
  function render(name){nav.forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});main.innerHTML=views[name]();wireTools(name);main.focus({preventScroll:true})}
  nav.forEach(b=>b.addEventListener('click',()=>render(b.dataset.view)));
  document.getElementById('roleSelect').addEventListener('change',e=>{if(document.querySelector('.nav-item.active')?.dataset.view==='handoffs'){render('handoffs');document.getElementById('roleCopy').textContent=e.target.options[e.target.selectedIndex].text}});
  render('overview');
})();
