-- Record the Founder-approved client availability and prices without inferring
-- inventory, compliance approval, or production-commerce authority.

update public.products
set price_cents = 3000,
    updated_at = now()
where slug = 'semax';

insert into public.products (
  slug,
  name,
  dose_label,
  category,
  description,
  price_cents,
  status,
  compliance_status
)
values (
  'lipo-c',
  'Lipo C',
  '',
  'uncategorized',
  'Client-confirmed available research format; detailed format remains unverified.',
  4500,
  'active',
  'pending_review'
)
on conflict (slug) do update
set name = excluded.name,
    price_cents = excluded.price_cents,
    status = excluded.status,
    updated_at = now();

insert into public.inventory (
  product_id,
  sku,
  quantity_on_hand,
  reorder_threshold
)
select id, 'EL-LIPOC', 0, 0
from public.products
where slug = 'lipo-c'
on conflict (sku) do nothing;
