import Stripe from 'stripe';

export const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
export const env = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
export const billingEnabled = () => process.env.BILLING_ENABLED === 'true';
export const stripe = () => new Stripe(env('STRIPE_SECRET_KEY'));
export async function userFrom(event) {
  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY'), authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}
export async function rest(path, options={}) {
  const serverKey = env('SUPABASE_SECRET_KEY');
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: serverKey, authorization: `Bearer ${serverKey}`, 'content-type':'application/json', prefer:'return=representation', ...(options.headers||{}) }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Database request failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
