import { json, stripe, rest, env } from './_billing.mjs';
export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  let stripeEvent;
  try{stripeEvent=stripe().webhooks.constructEvent(event.isBase64Encoded?Buffer.from(event.body,'base64'):event.body,event.headers['stripe-signature'],env('STRIPE_WEBHOOK_SECRET'));}catch(error){return json(400,{error:'Invalid signature'});}
  try{
    if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(stripeEvent.type)){
      const s=stripeEvent.data.object,m=s.metadata||{}; if(m.supabase_user_id&&m.product_id) await rest('subscriptions?on_conflict=stripe_subscription_id',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:m.supabase_user_id,product_id:m.product_id,stripe_customer_id:String(s.customer),stripe_subscription_id:s.id,cadence_days:Number(m.cadence_days),status:s.status==='canceled'?'canceled':s.status,current_period_end:s.items?.data?.[0]?.current_period_end?new Date(s.items.data[0].current_period_end*1000).toISOString():null,cancel_at_period_end:s.cancel_at_period_end})});
    }
    return json(200,{received:true});
  }catch(error){console.error(error);return json(500,{error:'Webhook processing failed'});}
}
