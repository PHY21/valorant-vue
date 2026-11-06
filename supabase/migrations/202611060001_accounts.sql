-- Apply once to the dedicated Atlas Supabase project, as database owner.
begin;
create table public.atlas_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24)
);
alter table public.atlas_profiles enable row level security;
revoke all on public.atlas_profiles from anon, authenticated;
grant select on public.atlas_profiles to anon, authenticated;
create policy "Public nicknames" on public.atlas_profiles for select to anon, authenticated using (true);

create function public.atlas_create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.atlas_profiles(id, display_name)
  values (new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data->>'display_name'), 24), ''), '图鉴访客'));
  return new;
end;
$$;
revoke all on function public.atlas_create_profile() from public, anon, authenticated;
create trigger atlas_user_created after insert on auth.users for each row execute function public.atlas_create_profile();
insert into public.atlas_profiles(id, display_name)
select id, coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'), 24), ''), '图鉴访客') from auth.users;

create table public.atlas_comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.atlas_profiles(id) on delete cascade,
  target text not null check (target ~ '^(player|team|tournament):[1-9][0-9]*$'),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);
create index atlas_comments_target_date on public.atlas_comments(target, created_at desc);
create index atlas_comments_author on public.atlas_comments(author_id);
alter table public.atlas_comments enable row level security;
revoke all on public.atlas_comments from anon, authenticated;
grant select on public.atlas_comments to anon, authenticated;
-- Clients cannot forge id/created_at, change ownership, or edit other rows.
grant insert (author_id, target, body, rating) on public.atlas_comments to authenticated;
grant delete on public.atlas_comments to authenticated;
create policy "Public comments" on public.atlas_comments for select to anon, authenticated using (true);
create policy "Own comments only" on public.atlas_comments for insert to authenticated
with check ((select auth.uid()) = author_id);
create policy "Delete own comments only" on public.atlas_comments for delete to authenticated
using ((select auth.uid()) = author_id);
commit;
