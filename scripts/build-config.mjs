import { writeFileSync } from 'node:fs';
const safe = value => JSON.stringify(value || '');
writeFileSync('js/runtime-config.js', `window.EVERLUME_RUNTIME_CONFIG={SUPABASE_URL:${safe(process.env.SUPABASE_URL)},SUPABASE_ANON_KEY:${safe(process.env.SUPABASE_ANON_KEY)},BILLING_ENABLED:${process.env.BILLING_ENABLED==='true'}};\n`);
