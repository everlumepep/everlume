-- Client-confirmed public prices transcribed from the supplied Everlume price
-- list on 2026-08-19. Only exact, unambiguous product/format matches are set.
-- Compliance remains pending_review and inventory remains zero, so this
-- migration publishes pricing without opening a purchase path.

update public.products set price_cents = 6500  where slug = 'tirzepatide-20mg';
update public.products set price_cents = 9800  where slug = 'tirzepatide-40mg';
update public.products set price_cents = 6000  where slug = 'retatrutide-10mg';
update public.products set price_cents = 9000  where slug = 'retatrutide-20mg';
update public.products set price_cents = 11500 where slug = 'klow-blend';
update public.products set price_cents = 4500  where slug = 'glutathione-1200mg';

do $$
declare v_bad integer;
begin
  select count(*) into v_bad
    from public.products
   where compliance_status <> 'pending_review';
  if v_bad > 0 then
    raise exception 'pricing migration must not approve products (% row(s) affected)', v_bad;
  end if;
end $$;
