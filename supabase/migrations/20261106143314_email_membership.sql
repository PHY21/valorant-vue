begin;
-- Preserve existing username identities, but reject new reserved-domain accounts.
create or replace function public.atlas_validate_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.email like '%@accounts.invalid' and new.email is not distinct from old.email then
      return new;
    end if;
  end if;
  if new.email is null or length(new.email) > 254
    or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or lower(new.email) like '%.invalid' then
    raise exception 'A real email address is required';
  end if;
  return new;
end;
$$;
revoke all on function public.atlas_validate_identity() from public, anon, authenticated;

create schema if not exists atlas_private;
revoke all on schema atlas_private from public;
grant usage on schema atlas_private to authenticated;
-- Internal RLS helper; no public RPC or user-editable metadata authorization.
create function atlas_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null
    and coalesce(u.is_anonymous,false) = false
    and u.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and lower(u.email) not like '%.invalid'
 );
$$;
revoke all on function atlas_private.is_member() from public, anon;
grant execute on function atlas_private.is_member() to authenticated;

revoke select on public.atlas_profiles, public.atlas_comments from anon;
drop policy "Public nicknames" on public.atlas_profiles;
drop policy "Public comments" on public.atlas_comments;
drop policy "Own comments only" on public.atlas_comments;
drop policy "Delete own comments only" on public.atlas_comments;
create policy "Member nicknames" on public.atlas_profiles for select to authenticated
 using ((select atlas_private.is_member()));
create policy "Member comments" on public.atlas_comments for select to authenticated
 using ((select atlas_private.is_member()));
create policy "Own comments only" on public.atlas_comments for insert to authenticated
 with check ((select atlas_private.is_member()) and (select auth.uid()) = author_id);
create policy "Delete own comments only" on public.atlas_comments for delete to authenticated
 using ((select atlas_private.is_member()) and (select auth.uid()) = author_id);

create table public.atlas_catalog (
 id integer primary key check (id=1),
 content jsonb not null check (jsonb_typeof(content) = 'object')
);
alter table public.atlas_catalog enable row level security;
revoke all on public.atlas_catalog from public, anon, authenticated;
grant select on public.atlas_catalog to authenticated;
create policy "Member catalog" on public.atlas_catalog for select to authenticated
 using ((select atlas_private.is_member()));
commit;
