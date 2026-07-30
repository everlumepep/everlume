// Everlume platform configuration.
// SUPABASE_URL and SUPABASE_ANON_KEY are public client credentials (the anon
// key is designed to be exposed; security is enforced by Postgres RLS).
// Fill these in at deploy time once the Supabase project exists.
// NEVER put a service_role key anywhere in this repository.
window.EVERLUME_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Storefront commerce switch. FALSE keeps the site inquiry-only: the bag and
  // checkout entry points are hidden and nothing can be added to a bag, even
  // if a product were otherwise authorized.
  //
  // This is an ADDITIONAL gate, never a bypass. Commerce requires this flag
  // AND per-product authorization (active + approved + priced + in stock).
  // Turning it on does not make any product purchasable on its own — G1 stands.
  COMMERCE_ENABLED: false,

  // Payment provider state. PENDING_PROVIDER until a processor has actually
  // approved Everlume's business — not when credentials merely exist.
  PAYMENT_STATE: 'PENDING_PROVIDER',

  // Entry gate configuration. Bumping GATE_VERSION or any policy version
  // forces every visitor to re-complete the gate.
  MIN_AGE: 18,
  GATE_VERSION: '2026-07-28.1',
  POLICY_VERSIONS: {
    terms: '1.0-draft',
    privacy: '1.0',
    research_use: '1.0'
  }
};
