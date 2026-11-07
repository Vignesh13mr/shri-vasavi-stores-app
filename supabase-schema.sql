-- Shri Vasavi Stores and Essence Mart catalog
-- Run this in Supabase SQL Editor before connecting the browser app.

create table if not exists public.shop_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'Shri Vasavi Stores and Essence Mart',
  address text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  opening_hours text not null default '',
  owner_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  category text not null check (char_length(category) between 1 and 32),
  price numeric(10, 2) not null check (price > 0),
  quantity integer not null default 0 check (quantity >= 0),
  image_url text,
  updated_at timestamptz not null default now()
);

insert into public.shop_settings (id, store_name)
values (1, 'Shri Vasavi Stores and Essence Mart')
on conflict (id) do nothing;

create or replace function public.set_catalog_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shop_products_updated_at on public.shop_products;
create trigger shop_products_updated_at
before update on public.shop_products
for each row execute function public.set_catalog_updated_at();

drop trigger if exists shop_settings_updated_at on public.shop_settings;
create trigger shop_settings_updated_at
before update on public.shop_settings
for each row execute function public.set_catalog_updated_at();

alter table public.shop_settings enable row level security;
alter table public.shop_products enable row level security;

drop policy if exists "Anyone can view shop details" on public.shop_settings;
create policy "Anyone can view shop details"
on public.shop_settings for select to anon, authenticated
using (true);

drop policy if exists "Owner can update shop details" on public.shop_settings;
create policy "Owner can update shop details"
on public.shop_settings for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Anyone can view products" on public.shop_products;
create policy "Anyone can view products"
on public.shop_products for select to anon, authenticated
using (true);

drop policy if exists "Only owner can add products" on public.shop_products;
create policy "Only owner can add products"
on public.shop_products for insert to authenticated
with check (auth.uid() = (select owner_id from public.shop_settings where id = 1));

drop policy if exists "Only owner can edit products" on public.shop_products;
create policy "Only owner can edit products"
on public.shop_products for update to authenticated
using (auth.uid() = (select owner_id from public.shop_settings where id = 1))
with check (auth.uid() = (select owner_id from public.shop_settings where id = 1));

drop policy if exists "Only owner can remove products" on public.shop_products;
create policy "Only owner can remove products"
on public.shop_products for delete to authenticated
using (auth.uid() = (select owner_id from public.shop_settings where id = 1));

revoke all on table public.shop_settings from public, anon, authenticated;
revoke all on table public.shop_products from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.shop_settings, public.shop_products to anon, authenticated;
grant update on table public.shop_settings to authenticated;
grant insert, update, delete on table public.shop_products to authenticated;

-- Enable live catalog refreshes for customers' open pages.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_products'
  ) then
    alter publication supabase_realtime add table public.shop_products;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_settings'
  ) then
    alter publication supabase_realtime add table public.shop_settings;
  end if;
exception when undefined_object then
  raise notice 'Realtime publication not found; enable Realtime for both tables in Supabase after setup.';
end;
$$;
