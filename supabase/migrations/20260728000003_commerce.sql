-- Everlume platform · 0003 — commerce data model: products, inventory,
-- addresses, orders, order items. Storefront and COMMAND read the same rows.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  dose_label text not null default '',
  category text not null default 'uncategorized',
  description text not null default '',
  price_cents integer check (price_cents is null or price_cents >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  -- Internal workflow state only. 'approved' means the internal review
  -- workflow completed — it is NOT a claim of legal/regulatory approval.
  compliance_status text not null default 'pending_review'
    check (compliance_status in ('pending_review', 'approved', 'restricted', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  reorder_threshold integer not null default 0 check (reorder_threshold >= 0),
  status text not null default 'ok' check (status in ('ok', 'low', 'out')),
  -- Room to grow: lots, batch numbers, expiration, cost, and supplier arrive
  -- as sibling tables (inventory_lots, inventory_movements) in a later phase.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_product on public.inventory (product_id);

create or replace function public.derive_inventory_status()
returns trigger language plpgsql as $$
begin
  new.status := case
    when new.quantity_on_hand <= 0 then 'out'
    when new.quantity_on_hand <= new.reorder_threshold then 'low'
    else 'ok'
  end;
  return new;
end $$;

drop trigger if exists trg_inventory_status on public.inventory;
create trigger trg_inventory_status
  before insert or update on public.inventory
  for each row execute function public.derive_inventory_status();

drop trigger if exists trg_inventory_updated_at on public.inventory;
create trigger trg_inventory_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default '',
  line1 text not null,
  line2 text not null default '',
  city text not null,
  region text not null default '',
  postal_code text not null,
  country text not null default 'US',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_addresses_user on public.addresses (user_id);

drop trigger if exists trg_addresses_updated_at on public.addresses;
create trigger trg_addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

create sequence if not exists public.everlume_order_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  order_number text unique,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'processing', 'ready',
                      'fulfilled', 'cancelled', 'refunded', 'attention_required')),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  currency text not null default 'usd',
  shipping_address_id uuid references public.addresses (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders (user_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_created on public.orders (created_at);

create or replace function public.assign_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'EL-' || nextval('public.everlume_order_seq');
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_number on public.orders;
create trigger trg_orders_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,       -- snapshot at time of order
  sku text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items (order_id);

-- ── Row level security ─────────────────────────────────────────────────────
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Catalog: the public sees active products; staff see everything.
drop policy if exists "products_select_public" on public.products;
create policy "products_select_public" on public.products
  for select using (status = 'active' or public.is_staff());

drop policy if exists "products_write_manager" on public.products;
create policy "products_write_manager" on public.products
  for all using (public.is_manager()) with check (public.is_manager());

-- Inventory is operational data: staff read, manager+ write.
drop policy if exists "inventory_select_staff" on public.inventory;
create policy "inventory_select_staff" on public.inventory
  for select using (public.is_staff());

drop policy if exists "inventory_write_manager" on public.inventory;
create policy "inventory_write_manager" on public.inventory
  for all using (public.is_manager()) with check (public.is_manager());

-- Addresses: customers manage their own; staff can read for fulfillment.
drop policy if exists "addresses_own" on public.addresses;
create policy "addresses_own" on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "addresses_select_staff" on public.addresses;
create policy "addresses_select_staff" on public.addresses
  for select using (public.is_staff());

-- Orders: customers see their own; staff see all. Customers may only create
-- their own order in 'pending'; every later state change is staff-only.
drop policy if exists "orders_select_own_or_staff" on public.orders;
create policy "orders_select_own_or_staff" on public.orders
  for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists "orders_insert_own_pending" on public.orders;
create policy "orders_insert_own_pending" on public.orders
  for insert with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "orders_update_staff" on public.orders;
create policy "orders_update_staff" on public.orders
  for update using (public.is_staff()) with check (public.is_staff());

-- Order items follow their order's visibility; items can only be added to a
-- customer's own order while it is still pending.
drop policy if exists "order_items_select_visible" on public.order_items;
create policy "order_items_select_visible" on public.order_items
  for select using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())
  ));

drop policy if exists "order_items_insert_own_pending" on public.order_items;
create policy "order_items_insert_own_pending" on public.order_items
  for insert with check (exists (
    select 1 from public.orders o
    where o.id = order_id
      and ((o.user_id = auth.uid() and o.status = 'pending') or public.is_staff())
  ));
