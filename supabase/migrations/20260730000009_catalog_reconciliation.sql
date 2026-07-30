-- Everlume platform · 0009 — catalog reconciliation to client-supplied data.
--
-- Client specified the SKU convention and the real dose range on 2026-07-30:
--   Tirzepatide  → EL-TR{mg}   (10, 20, 30, 40, 50)
--   Retatrutide  → EL-RT{mg}   (10, 20, 30, 40, 50 — confirmed same range)
--   Tesamorelin  → EL-TSM10
-- The remaining SKUs follow the same derived pattern, EL-{ABBREV}{mg}, and the
-- client RATIFIED both the derived codes and the full product list on
-- 2026-07-30. This catalog is settled; do not re-derive or re-propose it.
--
-- ADDITIVE. 0006 is left exactly as it was written — this migration reconciles
-- forward rather than rewriting history to look tidy (same discipline as 0007).
--
-- Compliance posture is UNCHANGED: every product stays compliance_status =
-- 'pending_review' with price_cents null. Adding real SKUs and doses is a
-- catalog-accuracy change, not an authorization change, and nothing here makes
-- any product purchasable.

-- ── 1. Re-key existing SKUs to the client convention ───────────────────────
update public.inventory i set sku = v.sku
from (values
  ('tirzepatide-20mg', 'EL-TR20'),
  ('tirzepatide-40mg', 'EL-TR40'),
  ('retatrutide-10mg', 'EL-RT10'),
  ('retatrutide-20mg', 'EL-RT20'),
  ('tesamorelin',      'EL-TSM10'),
  ('kpv',              'EL-KPV10'),
  ('bpc-157',          'EL-BPC10'),
  ('mots-c',           'EL-MOTSC10'),
  ('5-am',             'EL-5AM5'),
  ('nad-plus-100mg',   'EL-NAD1000'),
  ('ghk-cu',           'EL-GHKCU'),
  ('glutathione-1200mg', 'EL-GLUT1200'),
  ('tb-500',           'EL-TB500'),
  ('semax',            'EL-SEMAX'),
  ('klow-blend',       'EL-KLOW')
) as v(slug, sku)
where i.product_id = (select p.id from public.products p where p.slug = v.slug);

-- ── 2. Correct dose labels to the supplied specification ───────────────────
update public.products set dose_label = v.dose, updated_at = now()
from (values
  ('tesamorelin',    '10mg'),
  ('kpv',            '10mg'),
  ('bpc-157',        '10mg'),
  ('mots-c',         '10mg'),
  ('5-am',           '5mg'),
  ('nad-plus-100mg', '1000mg')
) as v(slug, dose)
where public.products.slug = v.slug;

-- NAD+ is a single 1000mg format; the second, unlabelled NAD+ row from 0006
-- is a duplicate of it and is retired rather than left to confuse the catalog.
update public.products set status = 'archived', updated_at = now()
where slug = 'nad-plus';

update public.products set name = 'NAD+', slug = 'nad-plus-1000mg', updated_at = now()
where slug = 'nad-plus-100mg';

-- ── 3. Additional Tirzepatide and Retatrutide formats ──────────────────────
-- Client confirmed 2026-07-30 that Retatrutide carries the same 10–50 range as
-- Tirzepatide. This migration has never been applied to any database, so the
-- range is completed here rather than as a second migration — the change is the
-- same catalog reconciliation, not a later correction to applied history.
insert into public.products (slug, name, dose_label, category, description, status)
values
  ('tirzepatide-10mg', 'Tirzepatide', '10mg', 'metabolic', 'Material format for controlled metabolic-pathway research.', 'active'),
  ('tirzepatide-30mg', 'Tirzepatide', '30mg', 'metabolic', 'Alternate-quantity format for laboratory investigation.', 'active'),
  ('tirzepatide-50mg', 'Tirzepatide', '50mg', 'metabolic', 'Alternate-quantity format for laboratory investigation.', 'active'),
  ('retatrutide-30mg', 'Retatrutide', '30mg', 'metabolic', 'Alternate-quantity format for laboratory investigation.', 'active'),
  ('retatrutide-40mg', 'Retatrutide', '40mg', 'metabolic', 'Alternate-quantity format for laboratory investigation.', 'active'),
  ('retatrutide-50mg', 'Retatrutide', '50mg', 'metabolic', 'Alternate-quantity format for laboratory investigation.', 'active')
on conflict (slug) do nothing;

-- ── 4. Materials not present in the 0006 seed ──────────────────────────────
insert into public.products (slug, name, dose_label, category, description, status)
values
  ('selank-10mg',      'Selank',       '10mg',        'peptide',  'Material format for controlled peptide research.', 'active'),
  ('kisspeptin-5mg',   'Kisspeptin',   '5mg',         'peptide',  'Material format for controlled peptide research.', 'active'),
  ('ss31-10mg',        'SS-31',        '10mg',        'cellular', 'Material format for mitochondrial-pathway research.', 'active'),
  ('l-carnitine-600mg','L-Carnitine',  '600mg/10ml',  'cellular', 'Solution format for cellular-pathway investigation.', 'active')
on conflict (slug) do nothing;

-- ── 5. Inventory records for the new formats ───────────────────────────────
-- Zero stock and pending_review, exactly as 0006 established: a new catalog
-- row must never arrive purchasable.
insert into public.inventory (product_id, sku, quantity_on_hand, reorder_threshold)
select p.id, v.sku, 0, 5
from (values
  ('tirzepatide-10mg',  'EL-TR10'),
  ('tirzepatide-30mg',  'EL-TR30'),
  ('tirzepatide-50mg',  'EL-TR50'),
  ('retatrutide-30mg',  'EL-RT30'),
  ('retatrutide-40mg',  'EL-RT40'),
  ('retatrutide-50mg',  'EL-RT50'),
  ('selank-10mg',       'EL-SEL10'),
  ('kisspeptin-5mg',    'EL-KISS5'),
  ('ss31-10mg',         'EL-SS31-10'),
  ('l-carnitine-600mg', 'EL-LCAR600')
) as v(slug, sku)
join public.products p on p.slug = v.slug
on conflict (sku) do nothing;

-- Guard: nothing in this migration may have opened a purchase path.
do $$
declare v_bad integer;
begin
  select count(*) into v_bad from public.products
   where compliance_status <> 'pending_review' or price_cents is not null;
  if v_bad > 0 then
    raise exception 'catalog reconciliation must not change authorization state (% row(s) affected)', v_bad;
  end if;
end $$;
