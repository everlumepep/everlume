// Everlume platform configuration.
// SUPABASE_URL and SUPABASE_ANON_KEY are public client credentials (the anon
// key is designed to be exposed; security is enforced by Postgres RLS).
// Fill these in at deploy time once the Supabase project exists.
// NEVER put a service_role key anywhere in this repository.
window.EVERLUME_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

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
