import { json, stripe, userFrom, rest } from './_billing.mjs';
export async function handler(event){
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{ const user=await userFrom(event); if(!user)return json(401,{error:'Sign in required'}); const rows=await rest(`profiles?id=eq.${user.id}&select=stripe_customer_id`); const customer=rows?.[0]?.stripe_customer_id; if(!customer)return json(409,{error:'No billing account found'}); const origin=event.headers.origin||`https://${event.headers.host}`; const session=await stripe().billingPortal.sessions.create({customer,return_url:`${origin}/account/`}); return json(200,{url:session.url}); }catch(error){console.error(error);return json(500,{error:'Billing portal is temporarily unavailable'});}
}
