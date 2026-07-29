// Shared Supabase client. Loaded after vendor/supabase.js and js/config.js.
// Exposes window.everlumeSupabase (null until the backend is configured) so
// every page can degrade gracefully while the Supabase project is pending.
(function () {
  const cfg = window.EVERLUME_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) {
    window.everlumeSupabase = null;
    return;
  }
  window.everlumeSupabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
})();
