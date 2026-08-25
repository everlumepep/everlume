import { billingEnabled, json, stripe, userFrom, rest } from './_billing.mjs';

const safeOrigin = event => {
  const configured = process.env.PUBLIC_SITE_ORIGIN;
  if (configured) {
    const origin = new URL(configured);
    if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') throw new Error('PUBLIC_SITE_ORIGIN must use HTTPS');
    return origin.origin;
  }
  const host = event.headers.host;
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error('Invalid host');
  return `https://${host}`;
};

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  if (!billingEnabled() || process.env.COMMERCE_ENABLED !== 'true' || process.env.PAYMENT_STATE !== 'APPROVED') {
    return json(503,{error:'Checkout is not currently available'});
  }
  let order;
  try {
    const user = await userFrom(event);
    if (!user) return json(401,{error:'Sign in required'});
    const body = JSON.parse(event.body || '{}');
    const lines = Array.isArray(body.items) ? body.items.map(item=>({slug:String(item.slug||''),quantity:Number(item.quantity)})) : [];
    const created = await rest('rpc/create_checkout_order',{method:'POST',body:JSON.stringify({
      p_user_id:user.id,p_email:user.email,p_address:body.address||{},p_lines:lines,
      p_research_acknowledged:body.acknowledgements?.research===true&&body.acknowledgements?.capacity===true&&body.acknowledgements?.terms===true
    })});
    order = created;
    const client = stripe();
    const origin = safeOrigin(event);
    const session = await client.checkout.sessions.create({
      mode:'payment',
      customer_email:user.email,
      line_items:order.lines.map(line=>({quantity:line.quantity,price_data:{currency:'usd',unit_amount:line.unit_amount,product_data:{name:`${line.name}${line.dose_label?' '+line.dose_label:''}`,metadata:{product_id:line.product_id,slug:line.slug,sku:line.sku}}}})),
      success_url:`${origin}/account/?order=success`,cancel_url:`${origin}/checkout.html?payment=cancelled`,
      metadata:{order_id:order.order_id,order_number:order.order_number,supabase_user_id:user.id},
      payment_intent_data:{metadata:{order_id:order.order_id,order_number:order.order_number,supabase_user_id:user.id}},
      expires_at:Math.floor(new Date(order.expires_at).getTime()/1000),allow_promotion_codes:false
    },{idempotencyKey:`everlume-order-${order.order_id}`});
    await rest('rpc/attach_checkout_session',{method:'POST',body:JSON.stringify({p_order_id:order.order_id,p_session_id:session.id})});
    return json(200,{url:session.url,orderNumber:order.order_number});
  } catch (error) {
    console.error(error);
    if (order?.order_id) {
      try { await rest('rpc/release_checkout_order',{method:'POST',body:JSON.stringify({p_order_id:order.order_id,p_reason:'session_creation_failed'})}); } catch (releaseError) { console.error(releaseError); }
    }
    return json(500,{error:'Secure checkout is temporarily unavailable'});
  }
}
