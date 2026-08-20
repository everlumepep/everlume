// Product detail. Renders one catalog entry and, when the authorization axes
// agree, an add-to-bag control. When they do not, it renders the honest reason
// and routes to inquiry instead — the same rule as the grid and the database.
(function () {
  const detail = document.getElementById('productDetail');
  const crumb = document.getElementById('crumbName');
  const catalog = window.everlumeCatalog;
  const cart = window.everlumeCart;
  const categoryProfiles = {
    metabolic: {
      title: 'Metabolic pathway research',
      intro: 'A structured material profile for controlled investigation of metabolic-pathway models and comparative assay conditions.',
      points: [
        ['Pathway context', 'Organizes study planning around defined metabolic signaling models and controlled assay conditions.'],
        ['Comparative analysis', 'Supports documented comparison across available formats, concentrations, and research conditions.'],
        ['Analytical record', 'Keeps material identity, lot information, format, and source documentation connected to the study.']
      ]
    },
    peptide: {
      title: 'Peptide interaction research',
      intro: 'A clear starting point for laboratory teams examining peptide identity, interaction models, and analytical characterization.',
      points: [
        ['Material identity', 'Centers the research record on a clearly identified peptide material and selected format.'],
        ['Interaction models', 'Provides context for controlled in-vitro interaction and comparative assay design.'],
        ['Documented handling', 'Encourages handling and storage aligned with the records supplied for the specific material.']
      ]
    },
    tissue: {
      title: 'Tissue-pathway research',
      intro: 'A focused profile for controlled laboratory investigation of tissue-pathway models and material behavior.',
      points: [
        ['Model context', 'Frames the material for defined tissue-pathway and comparative laboratory models.'],
        ['Assay planning', 'Supports repeatable study setup with documented conditions and analytical endpoints.'],
        ['Traceable record', 'Connects the selected format with its source, lot, and supporting documentation.']
      ]
    },
    cellular: {
      title: 'Cellular systems research',
      intro: 'A documented profile for controlled cellular-system studies, analytical characterization, and comparative material evaluation.',
      points: [
        ['Cellular context', 'Positions the material within defined cellular and biochemical research models.'],
        ['Analytical controls', 'Supports consistent comparison using recorded conditions, formats, and endpoints.'],
        ['Source clarity', 'Keeps identity and source documentation visible throughout the research workflow.']
      ]
    }
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function updateCartBadge() {
    const badge = document.getElementById('cartCount');
    if (!badge) return;
    const n = cart.count();
    badge.textContent = n > 0 ? String(n) : '';
    badge.hidden = n === 0;
  }

  function notFound() {
    detail.innerHTML = `<h1 class="page-title">Material not found</h1>
      <p class="policy-lead">This material is not in the current catalog. It may have been renamed or withdrawn.</p>
      <a class="btn btn-dark" href="index.html">Back to catalog</a>`;
  }

  async function render() {
    const slug = new URLSearchParams(location.search).get('slug');
    if (!slug) return notFound();
    const product = await catalog.find(slug);
    if (!product) return notFound();
    const { products } = await catalog.load();
    const variants = products.filter(item => item.name === product.name && item.category === product.category);
    const profile = categoryProfiles[product.category] || categoryProfiles.peptide;
    const related = products.filter(item => item.category === product.category && item.name !== product.name)
      .filter((item, index, list) => list.findIndex(other => other.name === item.name) === index)
      .slice(0, 3);

    const label = catalog.availabilityLabel(product);
    const price = catalog.formatPrice(product.price_cents);
    const name = escapeHtml(product.name);
    const dose = escapeHtml(product.dose_label || '—');

    document.title = `${product.name} ${product.dose_label} — Everlume`.replace(/\s+/g, ' ').trim();
    if (crumb) crumb.textContent = product.name;

    const buyBlock = label.state === 'available'
      ? `<div class="pd-buy">
           <label class="cart-qty">Qty
             <select id="pdQty">${Array.from({ length: cart.MAX_QTY }, (_, i) =>
               `<option value="${i + 1}">${i + 1}</option>`).join('')}</select>
           </label>
           <button class="btn btn-dark" id="pdAdd" type="button">Add to bag</button>
           <p class="pd-status" id="pdStatus" role="status" aria-live="polite"></p>
         </div>`
      : `<div class="pd-buy pd-buy-closed">
           <p class="pd-closed-reason">${escapeHtml(label.text)}</p>
           <p class="summary-note">This material is presented for documentation and inquiry. It is not offered for purchase on this site.</p>
           <a class="btn btn-dark" href="index.html#contact">Request documentation</a>
         </div>`;
    const subscribeBlock = label.state === 'available' && window.EVERLUME_CONFIG?.BILLING_ENABLED
      ? `<div class="subscription-card"><p class="eyebrow">Everlume Reserve</p><h2>Subscribe &amp; save 10%</h2><p>Flexible replenishment. Skip, reschedule, or cancel through My Everlume.</p><label>Delivery cadence<select id="pdCadence"><option value="30">Every 30 days</option><option value="60">Every 60 days</option><option value="90">Every 90 days</option></select></label><button class="btn btn-dark" id="pdSubscribe" type="button">Subscribe &amp; save</button><p id="pdSubscribeStatus" role="status" aria-live="polite"></p></div>` : '';

    const relatedBlock = related.length ? `<section class="pd-related" aria-labelledby="pdRelatedTitle">
      <div class="pd-section-head pd-section-head-inline">
        <div><p class="eyebrow">Continue exploring</p><h2 id="pdRelatedTitle">Related research materials.</h2></div>
        <a href="index.html#catalog">View full catalog</a>
      </div>
      <div class="pd-related-grid">${related.map(item => `<a class="pd-related-card" href="product.html?slug=${encodeURIComponent(item.slug)}">
        <span>${escapeHtml(item.category)} research</span><h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p><b>View material <span aria-hidden="true">&rarr;</span></b>
      </a>`).join('')}</div>
    </section>` : '';

    detail.innerHTML = `<div class="pd-layout">
      <div class="pd-visual pd-visual-${escapeHtml(product.category)}">
        <span class="pd-orbit pd-orbit-one" aria-hidden="true"></span><span class="pd-orbit pd-orbit-two" aria-hidden="true"></span>
        <div class="mini-vial"><img src="assets/products/everlume-vial-master-v1.png" alt="" width="1024" height="1365"><span>EVERLUME</span><b>${escapeHtml(product.sku)}</b><small>RESEARCH ONLY</small></div>
        <span class="pd-signal pd-signal-one">Identity</span><span class="pd-signal pd-signal-two">Format</span><span class="pd-signal pd-signal-three">Documentation</span>
      </div>
      <div class="pd-copy">
        <p class="eyebrow">${escapeHtml(product.category)} research</p>
        <h1 class="page-title">${name}</h1>
        ${variants.length > 1 ? `<label class="variant-picker pd-variant-picker"><span>Dosage</span><select id="pdVariant" aria-label="Select ${name} dosage">${variants.map(variant => `<option value="${escapeHtml(variant.slug)}"${variant.slug === product.slug ? ' selected' : ''}>${escapeHtml(variant.dose_label || '—')}</option>`).join('')}</select></label>` : `<p class="pd-dose">${dose}</p>`}
        <p class="policy-lead">${escapeHtml(product.description)}</p>
        <dl class="pd-specs">
          <div><dt>SKU</dt><dd>${escapeHtml(product.sku)}</dd></div>
          <div><dt>Format</dt><dd>${dose}</dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(product.category)}</dd></div>
          <div><dt>Availability</dt><dd><span class="avail avail-${label.state}">${escapeHtml(label.text)}</span></dd></div>
          ${price ? `<div><dt>Price</dt><dd>${escapeHtml(price)}</dd></div>` : ''}
        </dl>
        ${buyBlock}
        ${subscribeBlock}
        <div class="pd-save-wrap"><button class="pd-save-list" id="pdSaveList" type="button">Save to My Research List</button><p>Keep this material identity and selected format handy. No dosing or administration data is stored.</p></div>
        <p class="policy-note">For laboratory research and educational use only. Not for human or veterinary use. Everlume makes no medical, therapeutic, or efficacy claims. See the <a href="research-use.html">research-use policy</a>.</p>
      </div>
    </div>
    <section class="pd-research" aria-labelledby="pdResearchTitle">
      <div class="pd-section-head"><p class="eyebrow">Research focus</p><h2 id="pdResearchTitle">${escapeHtml(profile.title)}</h2><p>${escapeHtml(profile.intro)}</p></div>
      <div class="pd-focus-grid">${profile.points.map((point, index) => `<article class="pd-focus-card"><span>0${index + 1}</span><h3>${escapeHtml(point[0])}</h3><p>${escapeHtml(point[1])}</p></article>`).join('')}</div>
    </section>
    <section class="pd-editorial" aria-labelledby="pdEditorialTitle">
      <div class="pd-editorial-media"><img src="assets/editorial/everlume-molecular-light-v1.jpg" alt="Abstract warm molecular forms illuminated by soft golden light" width="1600" height="1067"></div>
      <div class="pd-editorial-copy"><p class="eyebrow">From identity to inquiry</p><h2 id="pdEditorialTitle">Research, presented with clarity.</h2>
        <p>Everlume pairs a refined material presentation with the practical records researchers need to evaluate fit before inquiry.</p>
        <ul><li>Material identity and selected format</li><li>Lot and source documentation</li><li>Handling aligned with supplied records</li></ul>
        <a class="text-link" href="index.html#contact">Request material documentation <span aria-hidden="true">&rarr;</span></a>
      </div>
    </section>
    ${relatedBlock}
    <aside class="pd-boundary"><p class="eyebrow">Research boundary</p><p>This page describes laboratory research context only. It does not provide dosing, administration, treatment, or human-use guidance.</p></aside>`;

    const addBtn = document.getElementById('pdAdd');
    const saveBtn = document.getElementById('pdSaveList');
    const savedId = `${product.slug}::${product.dose_label || ''}`;
    const syncSaved = () => { const saved = window.everlumeResearchList?.has(savedId); saveBtn.textContent = saved ? 'Saved to My Research List' : 'Save to My Research List'; saveBtn.setAttribute('aria-pressed', String(Boolean(saved))); };
    if (saveBtn) {
      syncSaved();
      saveBtn.addEventListener('click', () => { window.everlumeResearchList?.save({ slug: product.slug, name: product.name, dose: product.dose_label, sku: product.sku, category: product.category }); syncSaved(); });
    }
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const qty = Number(document.getElementById('pdQty').value) || 1;
        addBtn.disabled = true;
        const result = await cart.add(product.slug, qty);
        addBtn.disabled = false;
        const status = document.getElementById('pdStatus');
        status.textContent = result.ok
          ? (result.capped ? 'Added — quantity limited by available stock.' : 'Added to your bag.')
          : 'This material is not available for purchase.';
        updateCartBadge();
      });
    }
    const variantSelect = document.getElementById('pdVariant');
    if (variantSelect) {
      variantSelect.addEventListener('change', () => {
        location.href = 'product.html?slug=' + encodeURIComponent(variantSelect.value);
      });
    }
    document.getElementById('pdSubscribe')?.addEventListener('click', async event => {
      const button=event.currentTarget,status=document.getElementById('pdSubscribeStatus'); button.disabled=true; status.textContent='Opening secure checkout…';
      const {data:{session}}=await window.everlumeSupabase.auth.getSession();
      if(!session){ location.href='account/signin.html'; return; }
      try{const response=await fetch('/.netlify/functions/create-subscription',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.access_token}`},body:JSON.stringify({slug:product.slug,cadenceDays:Number(document.getElementById('pdCadence').value)})});const result=await response.json();if(!response.ok)throw new Error(result.error);location.href=result.url;}catch(error){status.textContent=error.message||'Subscription checkout is unavailable.';button.disabled=false;}
    });
  }

  render();
  updateCartBadge();
  if (cart) cart.onChange(updateCartBadge);
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
