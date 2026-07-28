-- Everlume platform · 0006 — seed the current storefront catalog.
-- Every product is seeded with compliance_status = 'pending_review': the
-- catalog's regulatory classification has NOT been reviewed, and nothing in
-- this schema should be read as making any product legal to sell. Items are
-- 'active' (they are already publicly presented on the existing site), but
-- price_cents stays null — there is no public pricing or checkout.

insert into public.products (slug, name, dose_label, category, description, status)
values
  ('tirzepatide-20mg', 'Tirzepatide', '20mg', 'metabolic', 'Material format for controlled metabolic-pathway research.', 'active'),
  ('tirzepatide-40mg', 'Tirzepatide', '40mg', 'metabolic', 'Alternate-quantity format for laboratory investigation.', 'active'),
  ('retatrutide-10mg', 'Retatrutide', '10mg', 'metabolic', 'Material format for metabolic-pathway research.', 'active'),
  ('retatrutide-20mg', 'Retatrutide', '20mg', 'metabolic', 'Alternate-quantity format for laboratory investigation.', 'active'),
  ('klow-blend', 'Klow Blend', 'Blend', 'peptide', 'Multi-component peptide research format.', 'active'),
  ('ghk-cu', 'GHK-Cu', '50mg / 100mg', 'peptide', 'Copper-peptide research formats.', 'active'),
  ('nad-plus-100mg', 'NAD+', '100mg', 'peptide', 'Material format for cellular-pathway investigation.', 'active'),
  ('glutathione-1200mg', 'Glutathione', '1200mg', 'peptide', 'Material format for biochemical research.', 'active'),
  ('kpv', 'KPV', '', 'tissue', 'Material format for laboratory tissue-pathway research.', 'active'),
  ('bpc-157', 'BPC-157', '', 'tissue', 'Material format for laboratory tissue-pathway research.', 'active'),
  ('tb-500', 'TB-500', '', 'tissue', 'Material format for laboratory tissue-pathway research.', 'active'),
  ('semax', 'Semax', '', 'tissue', 'Material format for controlled peptide research.', 'active'),
  ('nad-plus', 'NAD+', '', 'cellular', 'Material format for cellular-pathway investigation.', 'active'),
  ('5-am', '5-AM', '', 'cellular', 'Material format for metabolic-pathway investigation.', 'active'),
  ('mots-c', 'MOTS-C', '', 'cellular', 'Material format for mitochondrial-pathway research.', 'active'),
  ('tesamorelin', 'Tesamorelin', '', 'cellular', 'Material format for controlled peptide research.', 'active')
on conflict (slug) do nothing;

-- One inventory record per product, zero stock until real counts are entered.
insert into public.inventory (product_id, sku, quantity_on_hand, reorder_threshold)
select p.id, 'EL-' || upper(replace(p.slug, '-', '')), 0, 5
from public.products p
where not exists (select 1 from public.inventory i where i.product_id = p.id);
