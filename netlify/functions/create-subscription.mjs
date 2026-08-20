import { billingEnabled, json, stripe, userFrom, rest } from './_billing.mjs';
export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  if (!billingEnabled()) return json(503,{error:'Subscriptions are not currently available'});
  try {
    const user=await userFrom(event); if(!user) return json(401,{error:'Sign in required'});
    const {slug,cadenceDays}=JSON.parse(event.body||'{}');
    if(![30,60,90].includes(Number(cadenceDays))) return json(400,{error:'Choose 30, 60, or 90 days'});
    const rows=await rest(`products?slug=eq.${encodeURIComponent(slug)}&select=id,name,dose_label,price_cents,status,compliance_status`);
    const product=rows?.[0];
    if(!product || product.status!=='active' || product.compliance_status!=='approved' || !(product.price_cents>0)) return json(409,{error:'This format is not currently eligible for subscription'});
    const profiles=await rest(`profiles?id=eq.${user.id}&select=stripe_customer_id`);
    let customer=profiles?.[0]?.stripe_customer_id;
    const client=stripe();
    if(!customer){ const created=await client.customers.create({email:user.email,metadata:{supabase_user_id:user.id}}); customer=created.id; await rest(`profiles?id=eq.${user.id}`,{method:'PATCH',body:JSON.stringify({stripe_customer_id:customer})}); }
    const origin=event.headers.origin || `https://${event.headers.host}`;
    const session=await client.checkout.sessions.create({
      mode:'subscription', customer,
      line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:Math.round(product.price_cents*.9),recurring:{interval:'day',interval_count:Number(cadenceDays)},product_data:{name:`${product.name} ${product.dose_label}`,metadata:{product_id:product.id,slug}}}}],
      success_url:`${origin}/account/?subscription=success`, cancel_url:`${origin}/product.html?slug=${encodeURIComponent(slug)}`,
      subscription_data:{metadata:{supabase_user_id:user.id,product_id:product.id,cadence_days:String(cadenceDays)}},
      metadata:{supabase_user_id:user.id,product_id:product.id,cadence_days:String(cadenceDays)}, allow_promotion_codes:false
    });
    return json(200,{url:session.url});
  } catch(error){ console.error(error); return json(500,{error:'Subscription checkout is temporarily unavailable'}); }
}
