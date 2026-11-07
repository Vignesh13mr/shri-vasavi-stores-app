-- Enable several individually authenticated owners for the shop.
-- Run only after reviewing the access change: all approved owners can edit
-- shop details and inventory, and can add/remove owner accounts.

create table if not exists public.shop_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_email text not null,
  created_at timestamptz not null default now()
);

alter table public.shop_owners enable row level security;

-- Preserve the current single owner when migrating the original schema.
insert into public.shop_owners (user_id, owner_email)
select s.owner_id, coalesce(u.email, 'owner account')
from public.shop_settings s
left join auth.users u on u.id = s.owner_id
where s.id = 1 and s.owner_id is not null
on conflict (user_id) do nothing;

create or replace function public.is_shop_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.shop_owners where user_id = auth.uid());
$$;

create or replace function public.can_remove_shop_owner(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_shop_owner()
    and exists (select 1 from public.shop_owners where user_id = target_id)
    and (target_id <> auth.uid() or (select count(*) from public.shop_owners) > 1);
$$;

revoke all on function public.is_shop_owner() from public, anon;
revoke all on function public.can_remove_shop_owner(uuid) from public, anon;
grant execute on function public.is_shop_owner() to authenticated;
grant execute on function public.can_remove_shop_owner(uuid) to authenticated;

drop policy if exists "Owner can update shop details" on public.shop_settings;
create policy "Shop owners can update shop details"
on public.shop_settings for update to authenticated
using (public.is_shop_owner()) with check (public.is_shop_owner());

drop policy if exists "Only owner can add products" on public.shop_products;
drop policy if exists "Only owner can edit products" on public.shop_products;
drop policy if exists "Only owner can remove products" on public.shop_products;
create policy "Shop owners can add products"
on public.shop_products for insert to authenticated with check (public.is_shop_owner());
create policy "Shop owners can edit products"
on public.shop_products for update to authenticated
using (public.is_shop_owner()) with check (public.is_shop_owner());
create policy "Shop owners can remove products"
on public.shop_products for delete to authenticated using (public.is_shop_owner());

drop policy if exists "Owners can view owner accounts" on public.shop_owners;
create policy "Owners can view owner accounts"
on public.shop_owners for select to authenticated
using (user_id = auth.uid() or public.is_shop_owner());
drop policy if exists "Owners can add owner accounts" on public.shop_owners;
create policy "Owners can add owner accounts"
on public.shop_owners for insert to authenticated
with check (public.is_shop_owner());
drop policy if exists "Owners can remove owner accounts" on public.shop_owners;
create policy "Owners can remove owner accounts"
on public.shop_owners for delete to authenticated
using (public.can_remove_shop_owner(user_id));

revoke all on table public.shop_owners from public, anon, authenticated;
grant select, insert, delete on table public.shop_owners to authenticated;
