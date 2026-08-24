(function () {
  const LABEL_ORDER = [
    'tirzepatide-20mg', 'tirzepatide-40mg',
    'retatrutide-10mg', 'retatrutide-20mg',
    'klow-blend', 'ghk-cu', 'nad-plus-1000mg', 'glutathione-1200mg',
    'kpv', 'bpc-157', 'tb-500', 'semax', '5-am', 'mots-c', 'tesamorelin'
  ];

  const LABEL_DOSES = {
    'tirzepatide-20mg': '20mg',
    'tirzepatide-40mg': '40mg',
    'retatrutide-10mg': '10mg',
    'retatrutide-20mg': '20mg',
    'klow-blend': '',
    'ghk-cu': '50mg/100mg',
    'nad-plus-1000mg': '1000mg',
    'glutathione-1200mg': '1200mg',
    'kpv': '',
    'bpc-157': '',
    'tb-500': '',
    'semax': '',
    '5-am': '',
    'mots-c': '',
    'tesamorelin': ''
  };

  const LABEL_ASSETS = {
    'tirzepatide-20mg': 'assets/products/labels/tirzepatide-20mg-bottle-locked-reference-v1.png'
  };

  const LABEL_RANK = new Map(LABEL_ORDER.map((slug, index) => [slug, index]));

  function labelRank(slug) {
    const rank = LABEL_RANK.get(slug);
    return rank === undefined ? LABEL_ORDER.length : rank;
  }

  function labelDoseFor(product) {
    const dose = Object.prototype.hasOwnProperty.call(LABEL_DOSES, product.slug)
      ? LABEL_DOSES[product.slug]
      : (product.dose_label || '');
    return String(dose).replace(/\s*\/\s*/g, '/');
  }

  function labelAssetFor(product) {
    return LABEL_ASSETS[product.slug] || '';
  }

  window.EVERLUME_LABEL_CONFIG = {
    LABEL_ORDER,
    LABEL_DOSES,
    LABEL_ASSETS,
    LABEL_RANK,
    labelRank,
    labelDoseFor,
    labelAssetFor
  };
})();
