(() => {
  if (document.getElementById('pepTalkLauncher')) return;
  const medical = /\b(dos(e|age|ing)|inject(ion|ing)?|stack(ing)?|side effects?|treat(ment)?|medical|doctor|prescription|units?|reconstitut(e|ion))\b/i;
  const replies = [
    [/reward|referr|loyal/i, 'Everlume rewards include $10 credit after a referred customer’s first qualifying purchase, plus a loyalty reward after six qualifying purchases. Sign in to My Everlume to view your progress.'],
    [/subscr|reserve|replen/i, 'Everlume Reserve offers eligible products on a flexible 30, 60, or 90-day cadence. You can manage it through My Everlume.'],
    [/document|certificate|coa|lot|source/i, 'Material documentation can be requested from the product page or through the inquiry form. Everlume will confirm the records available for that material.'],
    [/ship|deliver|order|return/i, 'You can review order status in My Everlume. Shipping and return details are available in the site policies.'],
    [/format|strength|catalog|product|material/i, 'The catalog groups materials by research category. Where multiple formats exist, use the strength selector on the product card or detail page.'],
    [/contact|help|person|support/i, 'For account, order, or documentation support, use the contact form and the Everlume team can follow up.']
  ];
  const root = document.createElement('div');
  root.innerHTML = `<button class="pep-launcher" id="pepTalkLauncher" type="button" aria-haspopup="dialog" aria-controls="pepTalkPanel">
      <span class="pep-launcher-mark" aria-hidden="true">EL</span>
      <span class="pep-launcher-copy"><small>Everlume concierge</small><strong>Pep Talk</strong></span>
      <span class="pep-launcher-arrow" aria-hidden="true">↗</span>
    </button>
    <div class="pep-backdrop" id="pepTalkBackdrop" hidden></div>
    <aside class="pep-panel" id="pepTalkPanel" role="dialog" aria-modal="true" aria-labelledby="pepTalkTitle" hidden>
      <header class="pep-header">
        <span class="pep-header-mark" aria-hidden="true">EL</span>
        <div class="pep-heading"><p class="eyebrow">Private catalog concierge</p><h2 id="pepTalkTitle">Pep Talk</h2><p class="pep-status"><span class="pep-status-dot" aria-hidden="true"></span>Catalog guidance · Always discreet</p></div>
        <button class="pep-close" type="button" aria-label="Close Pep Talk">×</button>
      </header>
      <div class="pep-body">
        <div class="pep-intro"><span class="pep-intro-mark" aria-hidden="true">✦</span><div class="pep-bubble pep-bot">Illuminate what’s possible. I can guide you through materials, formats, documentation, rewards, subscriptions, orders, and shipping.</div></div>
        <div class="pep-quick" aria-label="Quick questions"><button>Explore the catalog</button><button>Compare formats</button><button>Rewards & referrals</button><button>Documentation</button><button>Orders & shipping</button></div>
        <section class="pep-list"><div class="pep-list-head"><h3>My Research List</h3><button type="button" class="pep-clear">Clear</button></div><p>Save material identities and formats for later review.</p><div class="pep-list-items"></div></section>
      </div>
      <form class="pep-form"><label class="sr-only" for="pepInput">Ask Pep Talk</label><input id="pepInput" maxlength="240" placeholder="Ask your Everlume concierge…"><button type="submit" aria-label="Send question"><span aria-hidden="true">↗</span></button></form>
    </aside>`;
  document.body.append(root);
  const launcher = document.getElementById('pepTalkLauncher');
  const panel = document.getElementById('pepTalkPanel');
  const backdrop = document.getElementById('pepTalkBackdrop');
  const body = panel.querySelector('.pep-body');
  const input = panel.querySelector('input');
  const open = () => { panel.hidden = false; backdrop.hidden = false; document.body.classList.add('pep-open'); setTimeout(() => input.focus(), 40); };
  const close = () => { panel.hidden = true; backdrop.hidden = true; document.body.classList.remove('pep-open'); launcher.focus(); };
  const bubble = (text, user = false) => { const el = document.createElement('div'); el.className = `pep-bubble ${user ? 'pep-user' : 'pep-bot'}`; el.textContent = text; body.insertBefore(el, body.querySelector('.pep-list')); body.scrollTop = body.scrollHeight; };
  const answer = question => {
    if (medical.test(question)) return 'Pep Talk can’t provide dosing, administration, stacking, side-effect, treatment, or medical guidance. Use the documentation supplied with the material and speak with a qualified professional.';
    const found = replies.find(([pattern]) => pattern.test(question));
    return found ? found[1] : 'I can help with the catalog, material formats, documentation, rewards, subscriptions, orders, shipping, or account access. For anything else, contact the Everlume team.';
  };
  const renderList = () => {
    const holder = panel.querySelector('.pep-list-items'); holder.replaceChildren();
    const items = window.everlumeResearchList?.list() || [];
    if (!items.length) { const empty = document.createElement('p'); empty.className = 'pep-empty'; empty.textContent = 'No saved materials yet. Use “Save to My Research List” on a product page.'; holder.append(empty); return; }
    items.forEach(item => { const card = document.createElement('div'); card.className = 'pep-list-card'; const link = document.createElement('a'); link.href = `product.html?slug=${encodeURIComponent(item.slug)}`; link.textContent = `${item.name}${item.dose ? ` · ${item.dose}` : ''}`; const meta = document.createElement('small'); meta.textContent = `${item.sku} · ${item.category} research`; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.addEventListener('click', () => window.everlumeResearchList.remove(item.id)); card.append(link, meta, remove); holder.append(card); });
  };
  launcher.addEventListener('click', open); backdrop.addEventListener('click', close); panel.querySelector('.pep-close').addEventListener('click', close);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(); });
  panel.querySelector('.pep-form').addEventListener('submit', event => { event.preventDefault(); const question = input.value.trim(); if (!question) return; bubble(question, true); input.value = ''; setTimeout(() => bubble(answer(question)), 160); });
  panel.querySelectorAll('.pep-quick button').forEach(button => button.addEventListener('click', () => { bubble(button.textContent, true); setTimeout(() => bubble(answer(button.textContent)), 160); }));
  panel.querySelector('.pep-clear').addEventListener('click', () => window.everlumeResearchList?.clear());
  window.everlumeResearchList?.subscribe(renderList); renderList();
})();
