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
  const materialProfiles = {
    tesamorelin: {
      what: 'Tesamorelin is a synthetic analog of growth hormone–releasing hormone, developed for controlled study of GHRH-receptor activity and connected endocrine signaling.',
      context: 'Research commonly examines GHRH-receptor pharmacology, Gs/cAMP signaling, pituitary model systems, GH/IGF-axis biology, and peptide stability.',
      limits: 'Results depend on receptor expression, biological model, proteolysis, and assay timing. Laboratory findings must not be translated into weight-loss, anti-aging, body-composition, or performance claims.',
      status: 'Approved tesamorelin drug products have narrow, product-specific labeling. This research-material listing is not an approved drug and does not imply therapeutic interchangeability.'
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
    const bagLink = badge.closest('.nav-bag');
    if (!catalog.commerceEnabled()) {
      bagLink.hidden = true;
      return;
    }
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
    const materialProfile = materialProfiles[product.slug] || null;
    const related = products.filter(item => item.category === product.category && item.name !== product.name)
      .filter((item, index, list) => list.findIndex(other => other.name === item.name) === index)
      .slice(0, 3);

    const label = catalog.availabilityLabel(product);
    const price = catalog.commerceEnabled() ? catalog.formatPrice(product.price_cents) : null;
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

    const hotspots = materialProfile ? `<div class="pd-hotspots" aria-label="Tesamorelin information points">
      <button class="pd-signal pd-signal-one" type="button" data-hotspot="what" aria-expanded="false">What it is</button>
      <button class="pd-signal pd-signal-two" type="button" data-hotspot="context" aria-expanded="false">Research context</button>
      <button class="pd-signal pd-signal-three" type="button" data-hotspot="limits" aria-expanded="false">Important limits</button>
      <div class="pd-hotspot-card" id="pdHotspotCard" aria-live="polite"><strong>Explore the material</strong><p>Hover, focus, or tap an information point.</p></div>
    </div>` : `<span class="pd-signal pd-signal-one">Identity</span><span class="pd-signal pd-signal-two">Format</span><span class="pd-signal pd-signal-three">Documentation</span>`;

    const materialBlock = materialProfile ? `<section class="pd-material-profile" aria-labelledby="pdMaterialTitle">
      <div class="pd-material-intro"><p class="eyebrow">Material profile</p><h2 id="pdMaterialTitle">Tesamorelin, in context.</h2><p>A plain-language research profile designed to answer the essential questions before inquiry.</p></div>
      <div class="pd-material-grid">
        <article><span>01</span><h3>What it is</h3><p>${escapeHtml(materialProfile.what)}</p></article>
        <article><span>02</span><h3>Research context</h3><p>${escapeHtml(materialProfile.context)}</p></article>
        <article><span>03</span><h3>Important limits</h3><p>${escapeHtml(materialProfile.limits)}</p></article>
        <article><span>04</span><h3>Regulatory distinction</h3><p>${escapeHtml(materialProfile.status)}</p></article>
      </div>
    </section>` : '';

    detail.innerHTML = `<div class="pd-layout">
      <div class="pd-visual pd-visual-${escapeHtml(product.category)}">
        <span class="pd-orbit pd-orbit-one" aria-hidden="true"></span><span class="pd-orbit pd-orbit-two" aria-hidden="true"></span>
        <div class="mini-vial"><img src="assets/products/everlume-vial-master-v1.png" alt="" width="1024" height="1365"><span>EVERLUME</span><b>${escapeHtml(product.sku)}</b><small>RESEARCH ONLY</small></div>
        ${hotspots}
      </div>
      <div class="pd-copy">
        <p class="eyebrow">${escapeHtml(product.category)} research</p>
        <h1 class="page-title">${name}</h1>
        ${variants.length > 1 ? `<label class="variant-picker pd-variant-picker"><span>Available quantity</span><select id="pdVariant" aria-label="Select ${name} available quantity">${variants.map(variant => `<option value="${escapeHtml(variant.slug)}"${variant.slug === product.slug ? ' selected' : ''}>${escapeHtml(variant.dose_label || '—')}</option>`).join('')}</select></label>` : `<p class="pd-dose">Available quantity · ${dose}</p>`}
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
    ${materialBlock}
    <section class="pd-research" aria-labelledby="pdResearchTitle">
      <div class="pd-section-head"><p class="eyebrow">Research focus</p><h2 id="pdResearchTitle">${escapeHtml(profile.title)}</h2><p>${escapeHtml(profile.intro)}</p></div>
      <div class="pd-focus-grid">${profile.points.map((point, index) => `<article class="pd-focus-card"><span>0${index + 1}</span><h3>${escapeHtml(point[0])}</h3><p>${escapeHtml(point[1])}</p></article>`).join('')}</div>
    </section>
    <section class="pd-editorial" aria-labelledby="pdEditorialTitle">
      <div class="pd-editorial-media"><img src="assets/editorial/everlume-documentation-still-life-v1.jpg" alt="Research vial presented beside organized specification documents" width="1680" height="945"></div>
      <div class="pd-editorial-copy"><p class="eyebrow">Before you inquire</p><h2 id="pdEditorialTitle">The material record, made visible.</h2>
        <p>Use this page to identify the material and selected format. Everlume confirms the current supporting record set before any fulfillment discussion.</p>
        <ul><li>Material name, reference code, and selected format</li><li>Available lot and source records</li><li>Storage and handling aligned with supplied documentation</li></ul>
        <a class="text-link" href="index.html#contact">Request material documentation <span aria-hidden="true">&rarr;</span></a>
      </div>
    </section>
    <section class="pd-process" aria-labelledby="pdProcessTitle">
      <div class="pd-section-head"><p class="eyebrow">A controlled path</p><h2 id="pdProcessTitle">What happens next.</h2><p>No maze, no ambiguous checkout. Each request moves through three explicit steps.</p></div>
      <div class="pd-process-grid"><article><span>01</span><h3>Identify</h3><p>Select the material and available format that belongs in your inquiry.</p></article><article><span>02</span><h3>Confirm</h3><p>Everlume confirms current availability, documentation, and applicable requirements.</p></article><article><span>03</span><h3>Proceed</h3><p>Eligible fulfillment details are communicated directly after review.</p></article></div>
    </section>
    ${relatedBlock}
    <aside class="pd-boundary"><p class="eyebrow">Research boundary</p><p>This page describes laboratory research context only. It does not provide dosing, administration, treatment, or human-use guidance.</p></aside>`;

    const addBtn = document.getElementById('pdAdd');
    const hotspotCard = document.getElementById('pdHotspotCard');
    if (hotspotCard && materialProfile) {
      const hotspotCopy = {
        what: ['What it is', materialProfile.what],
        context: ['Research context', materialProfile.context],
        limits: ['Important limits', materialProfile.limits]
      };
      document.querySelectorAll('[data-hotspot]').forEach(button => {
        const show = () => {
          const [title, copy] = hotspotCopy[button.dataset.hotspot];
          hotspotCard.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p>`;
          document.querySelectorAll('[data-hotspot]').forEach(item => item.setAttribute('aria-expanded', String(item === button)));
          hotspotCard.classList.add('is-visible');
        };
        button.addEventListener('mouseenter', show);
        button.addEventListener('focus', show);
        button.addEventListener('click', show);
      });
      document.querySelector('.pd-visual')?.addEventListener('mouseleave', () => {
        hotspotCard.classList.remove('is-visible');
        document.querySelectorAll('[data-hotspot]').forEach(item => item.setAttribute('aria-expanded', 'false'));
      });
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        hotspotCard.classList.remove('is-visible');
        document.querySelectorAll('[data-hotspot]').forEach(item => item.setAttribute('aria-expanded', 'false'));
      });
    }
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
