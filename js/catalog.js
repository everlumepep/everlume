// Everlume catalog. Loaded after js/supabase-client.js.
// Exposes window.everlumeCatalog — the single source of truth for what the
// storefront may display and what a customer may actually buy.
//
// Reads from Supabase when configured, otherwise falls back to a local mirror
// of supabase/migrations/0006 so the storefront renders before the backend
// exists. The fallback mirrors the seed exactly, INCLUDING its authorization
// state: every product is pending_review with no price.
(function () {
  const SUPPORT_EMAIL = 'hello@myeverlume.com';

  // Mirror of migrations 0006 + 0009. Catalog RATIFIED by the client
  // 2026-07-30: SKU convention (EL-TR/RT/TSM explicit, remainder derived as
  // EL-{ABBREV}{mg}), both dose ranges, and the full product list. Settled —
  // changes come from the client, not from re-derivation.
  //
  // Kept deliberately identical to the seed — including its authorization
  // state — so the pre-backend storefront cannot present a product the
  // database would refuse. tests/schema.test.mjs pins the two together.
  const SEED = [
    ['tirzepatide-10mg', 'Tirzepatide', '10mg', 'metabolic', 'EL-TR10', 'Material format for controlled metabolic-pathway research.'],
    ['tirzepatide-20mg', 'Tirzepatide', '20mg', 'metabolic', 'EL-TR20', 'Alternate-quantity format for laboratory investigation.'],
    ['tirzepatide-30mg', 'Tirzepatide', '30mg', 'metabolic', 'EL-TR30', 'Alternate-quantity format for laboratory investigation.'],
    ['tirzepatide-40mg', 'Tirzepatide', '40mg', 'metabolic', 'EL-TR40', 'Alternate-quantity format for laboratory investigation.'],
    ['tirzepatide-50mg', 'Tirzepatide', '50mg', 'metabolic', 'EL-TR50', 'Alternate-quantity format for laboratory investigation.'],
    ['retatrutide-10mg', 'Retatrutide', '10mg', 'metabolic', 'EL-RT10', 'Material format for metabolic-pathway research.'],
    ['retatrutide-20mg', 'Retatrutide', '20mg', 'metabolic', 'EL-RT20', 'Alternate-quantity format for laboratory investigation.'],
    ['retatrutide-30mg', 'Retatrutide', '30mg', 'metabolic', 'EL-RT30', 'Alternate-quantity format for laboratory investigation.'],
    ['retatrutide-40mg', 'Retatrutide', '40mg', 'metabolic', 'EL-RT40', 'Alternate-quantity format for laboratory investigation.'],
    ['retatrutide-50mg', 'Retatrutide', '50mg', 'metabolic', 'EL-RT50', 'Alternate-quantity format for laboratory investigation.'],
    ['tesamorelin', 'Tesamorelin', '10mg', 'metabolic', 'EL-TSM10', 'Material format for controlled peptide research.'],
    ['selank-10mg', 'Selank', '10mg', 'peptide', 'EL-SEL10', 'Material format for controlled peptide research.'],
    ['kisspeptin-5mg', 'Kisspeptin', '5mg', 'peptide', 'EL-KISS5', 'Material format for controlled peptide research.'],
    ['semax', 'Semax', '', 'peptide', 'EL-SEMAX', 'Material format for controlled peptide research.'],
    ['ghk-cu', 'GHK-Cu', '50mg / 100mg', 'peptide', 'EL-GHKCU', 'Copper-peptide research formats.'],
    ['glutathione-1200mg', 'Glutathione', '1200mg', 'peptide', 'EL-GLUT1200', 'Material format for biochemical research.'],
    ['klow-blend', 'Klow Blend', 'Blend', 'peptide', 'EL-KLOW', 'Multi-component peptide research format.'],
    ['kpv', 'KPV', '10mg', 'tissue', 'EL-KPV10', 'Material format for laboratory tissue-pathway research.'],
    ['bpc-157', 'BPC-157', '10mg', 'tissue', 'EL-BPC10', 'Material format for laboratory tissue-pathway research.'],
    ['tb-500', 'TB-500', '', 'tissue', 'EL-TB500', 'Material format for laboratory tissue-pathway research.'],
    ['nad-plus-1000mg', 'NAD+', '1000mg', 'cellular', 'EL-NAD1000', 'Material format for cellular-pathway investigation.'],
    ['mots-c', 'MOTS-C', '10mg', 'cellular', 'EL-MOTSC10', 'Material format for mitochondrial-pathway research.'],
    ['ss31-10mg', 'SS-31', '10mg', 'cellular', 'EL-SS31-10', 'Material format for mitochondrial-pathway research.'],
    ['5-am', '5-AM', '5mg', 'cellular', 'EL-5AM5', 'Material format for metabolic-pathway investigation.'],
    ['l-carnitine-600mg', 'L-Carnitine', '600mg/10ml', 'cellular', 'EL-LCAR600', 'Solution format for cellular-pathway investigation.']
  ].map(([slug, name, dose, category, sku, description]) => ({
    slug,
    name,
    dose_label: dose,
    category,
    description,
    price_cents: null,
    status: 'active',
    compliance_status: 'pending_review',
    sku,
    quantity_on_hand: 0,
    quantity_reserved: 0,
    inventory_status: 'out'
  }));

  const CATEGORIES = [
    { key: 'all', label: 'All' },
    { key: 'metabolic', label: 'Metabolic' },
    { key: 'peptide', label: 'Peptide' },
    { key: 'tissue', label: 'Tissue' },
    { key: 'cellular', label: 'Cellular' }
  ];

  // ── Authorization ────────────────────────────────────────────────────────
  // D-III: a product's commerce path is determined by the AGREEMENT of its
  // axes, not by any single flag. If they disagree, the product fails closed.
  //
  // G1 is absolute here: pending_review is NOT purchasable, and there is no
  // bypass — no query string, no config toggle, no "test mode". A build that
  // needs a purchasable fixture must approve and price it like production.
  function commerceEnabled() {
    return (window.EVERLUME_CONFIG || {}).COMMERCE_ENABLED === true;
  }

  function availability(product) {
    const reasons = [];
    // The storefront switch is an ADDITIONAL axis, not an override. It can only
    // ever close the purchase path — it cannot open one for a product whose
    // own axes disagree.
    if (!commerceEnabled()) reasons.push('commerce_closed');
    if (product.status !== 'active') reasons.push('not_active');
    if (product.compliance_status !== 'approved') reasons.push('compliance_review_pending');
    if (product.price_cents === null || product.price_cents === undefined) reasons.push('no_price');
    else if (!(product.price_cents > 0)) reasons.push('invalid_price');
    if (available(product) <= 0) reasons.push('out_of_stock');
    return { purchasable: reasons.length === 0, reasons };
  }

  function available(product) {
    return Math.max(0, (product.quantity_on_hand || 0) - (product.quantity_reserved || 0));
  }

  // Customer-facing explanation. Deliberately does not imply a future date or
  // a regulatory outcome — the review is internal and its result is not known.
  function availabilityLabel(product) {
    const { purchasable, reasons } = availability(product);
    if (purchasable) return { state: 'available', text: 'In stock' };
    // When the storefront is inquiry-only, say so plainly rather than implying
    // the material itself is the reason it cannot be bought.
    if (reasons.includes('commerce_closed')) {
      return { state: 'review', text: 'Documentation available — inquiries only' };
    }
    if (reasons.includes('compliance_review_pending')) {
      return { state: 'review', text: 'Documentation available — inquiries only' };
    }
    if (reasons.includes('no_price') || reasons.includes('invalid_price')) {
      return { state: 'review', text: 'Documentation available — inquiries only' };
    }
    if (reasons.includes('out_of_stock')) return { state: 'out', text: 'Out of stock' };
    return { state: 'unavailable', text: 'Unavailable' };
  }

  function formatPrice(cents) {
    if (cents === null || cents === undefined) return null;
    return '$' + (cents / 100).toFixed(2);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  let cache = null;

  async function load() {
    if (cache) return cache;
    const client = window.everlumeSupabase;
    if (!client) {
      cache = { products: SEED.slice(), source: 'fallback' };
      return cache;
    }
    try {
      const { data, error } = await client
        .from('products')
        .select('slug,name,dose_label,category,description,price_cents,status,compliance_status,inventory(sku,quantity_on_hand,quantity_reserved,status)')
        .eq('status', 'active')
        .order('category', { ascending: true });
      if (error) throw error;
      const products = (data || []).map(row => {
        const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
        return {
          slug: row.slug,
          name: row.name,
          dose_label: row.dose_label || '',
          category: row.category,
          description: row.description || '',
          price_cents: row.price_cents,
          status: row.status,
          compliance_status: row.compliance_status,
          sku: (inv && inv.sku) || '',
          quantity_on_hand: (inv && inv.quantity_on_hand) || 0,
          quantity_reserved: (inv && inv.quantity_reserved) || 0,
          inventory_status: (inv && inv.status) || 'out'
        };
      });
      cache = { products, source: 'supabase' };
      return cache;
    } catch (error) {
      // Never fail the storefront open. A backend error must not turn into a
      // catalog with unknown authorization state, so fall back to the seed —
      // which is pending_review, i.e. not purchasable.
      cache = { products: SEED.slice(), source: 'fallback-after-error' };
      return cache;
    }
  }

  async function find(slug) {
    const { products } = await load();
    return products.find(p => p.slug === slug) || null;
  }

  window.everlumeCatalog = {
    load,
    find,
    commerceEnabled,
    availability,
    availabilityLabel,
    available,
    formatPrice,
    categories: CATEGORIES,
    supportEmail: SUPPORT_EMAIL
  };
})();
