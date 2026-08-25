-- Atomic one-time checkout reservation and Stripe reconciliation.

alter table public.orders
  add column if not exists stripe_checkout_session_id text unique,
  add column if not exists stripe_payment_intent_id text unique,
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists customer_email text not null default '',
  add column if not exists research_use_acknowledged boolean not null default false;

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','committed','released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, inventory_id)
);

alter table public.inventory_reservations enable row level security;
create policy "staff read reservations" on public.inventory_reservations
  for select using (public.is_staff());

create or replace function public.create_checkout_order(
  p_user_id uuid,
  p_email text,
  p_address jsonb,
  p_lines jsonb,
  p_research_acknowledged boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_address public.addresses;
  v_line jsonb;
  v_product public.products;
  v_inventory public.inventory;
  v_qty integer;
  v_subtotal integer := 0;
  v_result_lines jsonb := '[]'::jsonb;
  v_expires timestamptz := now() + interval '31 minutes';
begin
  if p_user_id is null or coalesce(trim(p_email),'') = '' then
    raise exception 'authenticated customer and email required';
  end if;
  if not p_research_acknowledged then raise exception 'research-use acknowledgement required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'at least one line required'; end if;
  if jsonb_array_length(p_lines) > 20 then raise exception 'too many order lines'; end if;
  if coalesce(trim(p_address->>'line1'),'') = ''
     or coalesce(trim(p_address->>'city'),'') = ''
     or coalesce(trim(p_address->>'postal_code'),'') = ''
     or coalesce(trim(p_address->>'country'),'') = '' then
    raise exception 'complete shipping address required';
  end if;

  insert into public.addresses(user_id,label,line1,line2,city,region,postal_code,country)
  values (p_user_id,'Checkout',trim(p_address->>'line1'),coalesce(trim(p_address->>'line2'),''),
          trim(p_address->>'city'),trim(p_address->>'region'),trim(p_address->>'postal_code'),
          coalesce(nullif(trim(p_address->>'country'),''),'US'))
  returning * into v_address;

  insert into public.orders(user_id,status,commercial_status,payment_status,fulfillment_status,
                            subtotal_cents,total_cents,currency,shipping_address_id,
                            customer_email,research_use_acknowledged,checkout_expires_at)
  values (p_user_id,'pending','pending','pending','reserved',0,0,'usd',v_address.id,
          lower(trim(p_email)),true,v_expires)
  returning * into v_order;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_qty := greatest(0, least(10, coalesce((v_line->>'quantity')::integer,0)));
    if v_qty < 1 then raise exception 'invalid quantity'; end if;

    select p.* into v_product from public.products p
      where p.slug = v_line->>'slug' for update;
    if not found or v_product.status <> 'active' or v_product.compliance_status <> 'approved'
       or coalesce(v_product.price_cents,0) <= 0 then
      raise exception 'product is not approved for checkout: %', v_line->>'slug';
    end if;

    select i.* into v_inventory from public.inventory i
      where i.product_id = v_product.id for update;
    if not found or v_inventory.quantity_on_hand - v_inventory.quantity_reserved < v_qty then
      raise exception 'insufficient inventory: %', v_product.slug;
    end if;

    update public.inventory set quantity_reserved = quantity_reserved + v_qty
      where id = v_inventory.id;
    insert into public.order_items(order_id,product_id,product_name,sku,quantity,unit_price_cents)
      values(v_order.id,v_product.id,v_product.name,v_inventory.sku,v_qty,v_product.price_cents);
    insert into public.inventory_reservations(order_id,inventory_id,quantity,status,expires_at)
      values(v_order.id,v_inventory.id,v_qty,'active',v_expires);

    v_subtotal := v_subtotal + (v_product.price_cents * v_qty);
    v_result_lines := v_result_lines || jsonb_build_array(jsonb_build_object(
      'product_id',v_product.id,'slug',v_product.slug,'name',v_product.name,
      'dose_label',v_product.dose_label,'sku',v_inventory.sku,'quantity',v_qty,
      'unit_amount',v_product.price_cents));
  end loop;

  update public.orders set subtotal_cents=v_subtotal,total_cents=v_subtotal where id=v_order.id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,metadata)
    values(p_user_id,'checkout.reserved','orders',v_order.id::text,
           jsonb_build_object('subtotal_cents',v_subtotal,'expires_at',v_expires));
  return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,
                            'subtotal_cents',v_subtotal,'expires_at',v_expires,'lines',v_result_lines);
end $$;

create or replace function public.attach_checkout_session(p_order_id uuid,p_session_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.orders set stripe_checkout_session_id=p_session_id
   where id=p_order_id and payment_status='pending';
  if not found then raise exception 'order unavailable for checkout session'; end if;
end $$;

create or replace function public.capture_checkout_order(p_session_id text,p_payment_intent_id text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders; v_res record;
begin
  select * into v_order from public.orders where stripe_checkout_session_id=p_session_id for update;
  if not found then raise exception 'unknown checkout session'; end if;
  if v_order.payment_status='captured' then return; end if;
  if v_order.payment_status <> 'pending' then raise exception 'order is not pending payment'; end if;
  for v_res in select * from public.inventory_reservations where order_id=v_order.id and status='active' for update
  loop
    update public.inventory set quantity_on_hand=quantity_on_hand-v_res.quantity,
      quantity_reserved=quantity_reserved-v_res.quantity where id=v_res.inventory_id;
    update public.inventory_reservations set status='committed',updated_at=now() where id=v_res.id;
  end loop;
  update public.orders set payment_status='captured',commercial_status='confirmed',
    fulfillment_status='unfulfilled',status='confirmed',stripe_payment_intent_id=p_payment_intent_id
    where id=v_order.id;
  insert into public.audit_events(action,entity_type,entity_id,metadata)
    values('payment.captured','orders',v_order.id::text,jsonb_build_object('checkout_session_id',p_session_id));
end $$;

create or replace function public.release_checkout_order(p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders; v_res record;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.payment_status='captured' then return; end if;
  for v_res in select * from public.inventory_reservations where order_id=p_order_id and status='active' for update
  loop
    update public.inventory set quantity_reserved=greatest(0,quantity_reserved-v_res.quantity) where id=v_res.inventory_id;
    update public.inventory_reservations set status='released',updated_at=now() where id=v_res.id;
  end loop;
  update public.orders set payment_status='expired',commercial_status='cancelled',
    fulfillment_status='cancelled',status='cancelled' where id=p_order_id;
  insert into public.audit_events(action,entity_type,entity_id,metadata)
    values('checkout.released','orders',p_order_id::text,jsonb_build_object('reason',coalesce(p_reason,'unspecified')));
end $$;

revoke all on function public.create_checkout_order(uuid,text,jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.attach_checkout_session(uuid,text) from public,anon,authenticated;
revoke all on function public.capture_checkout_order(text,text) from public,anon,authenticated;
revoke all on function public.release_checkout_order(uuid,text) from public,anon,authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname='service_role') then
    grant execute on function public.create_checkout_order(uuid,text,jsonb,jsonb,boolean) to service_role;
    grant execute on function public.attach_checkout_session(uuid,text) to service_role;
    grant execute on function public.capture_checkout_order(text,text) to service_role;
    grant execute on function public.release_checkout_order(uuid,text) to service_role;
  end if;
end $$;
