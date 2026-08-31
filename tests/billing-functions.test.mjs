import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { handler as webhook } from '../netlify/functions/stripe-webhook.mjs';
import { handler as createSubscription } from '../netlify/functions/create-subscription.mjs';

test('subscription endpoint fails closed when billing is disabled', async () => {
  const previous = process.env.BILLING_ENABLED;
  process.env.BILLING_ENABLED = 'false';
  try {
    const response = await createSubscription({ httpMethod: 'POST', headers: {}, body: '{}' });
    assert.equal(response.statusCode, 503);
    assert.match(response.body, /not currently available/);
  } finally {
    if (previous === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = previous;
  }
});

test('Stripe webhook rejects an invalid signature', async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_verification_only';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_verification_only';
  try {
    const response = await webhook({ httpMethod: 'POST', headers: { 'stripe-signature': 'invalid' }, body: '{}' });
    assert.equal(response.statusCode, 400);
    assert.match(response.body, /Invalid signature/);
  } finally {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
  }
});

test('Stripe webhook accepts a correctly signed test event', async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = 'whsec_verification_only';
  const payload = JSON.stringify({
    id: 'evt_test_verification',
    object: 'event',
    api_version: '2026-07-29.dahlia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    type: 'customer.created',
    data: { object: { id: 'cus_test_verification', object: 'customer' } }
  });
  process.env.STRIPE_SECRET_KEY = 'sk_test_verification_only';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  try {
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const response = await webhook({ httpMethod: 'POST', headers: { 'stripe-signature': signature }, body: payload, isBase64Encoded: false });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { received: true });
  } finally {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
  }
});
