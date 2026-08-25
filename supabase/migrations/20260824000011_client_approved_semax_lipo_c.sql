-- EVERLUME client approval receipt · 2026-08-24
-- Approved availability and price:
--   Semax  — $30
--   Lipo C — $45
--
-- This migration does not invent inventory. Both rows remain unavailable for
-- checkout until an authorized physical count sets quantity_on_hand > 0.

insert into public.products
  (slug, name, dose_label, category, description, status, compliance_status, price_cents)
values
  ('lipo-c', 'Lipo C', '', 'cellular',
   'Material format for controlled laboratory research.',
   'active', 'approved', 4500)
on conflict (slug) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  status = 'active',
  compliance_status = 'approved',
  updated_at = now();

update public.products
   set price_cents = 3000,
       status = 'active',
       compliance_status = 'approved',
       updated_at = now()
 where slug = 'semax';

insert into public.inventory (product_id, sku, quantity_on_hand, quantity_reserved, reorder_threshold)
select p.id, v.sku, 0, 0, 0
from (values
  ('semax', 'EL-SEMAX'),
  ('lipo-c', 'EL-LIPOC')
) as v(slug, sku)
join public.products p on p.slug = v.slug
on conflict (sku) do update set product_id = excluded.product_id;

do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from public.products
   where (slug = 'semax' and (price_cents <> 3000 or compliance_status <> 'approved'))
      or (slug = 'lipo-c' and (price_cents <> 4500 or compliance_status <> 'approved'));
  if v_bad <> 0 then
    raise exception 'approved Semax/Lipo C register did not reconcile';
  end if;

  select count(*) into v_bad
    from public.inventory i
    join public.products p on p.id = i.product_id
   where p.slug in ('semax', 'lipo-c')
     and (i.quantity_on_hand <> 0 or i.quantity_reserved <> 0);
  if v_bad <> 0 then
    raise exception 'approval migration must not invent inventory';
  end if;
end $$;
