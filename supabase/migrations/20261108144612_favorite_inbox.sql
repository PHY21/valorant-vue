create table public.atlas_follows (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('player','team')),
  target_id integer not null check (target_id > 0),
  primary key(user_id, kind, target_id)
);
create index atlas_follows_target on public.atlas_follows(kind,target_id,user_id);
create table public.atlas_inbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event jsonb not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);
create index atlas_inbox_recipient on public.atlas_inbox(user_id,id desc);
create index atlas_inbox_unread on public.atlas_inbox(user_id) where not is_read;
alter table public.atlas_follows enable row level security;
alter table public.atlas_inbox enable row level security;
revoke all on public.atlas_follows,public.atlas_inbox from public,anon,authenticated;
grant select,delete on public.atlas_follows to authenticated;
grant insert(user_id,kind,target_id) on public.atlas_follows to authenticated;
grant select,update(is_read) on public.atlas_inbox to authenticated;
create policy own_follows on public.atlas_follows for all to authenticated
  using (user_id=(select auth.uid()) and (select atlas_private.is_member()))
  with check (user_id=(select auth.uid()) and (select atlas_private.is_member()));
create policy own_messages on public.atlas_inbox for select to authenticated
  using (user_id=(select auth.uid()) and (select atlas_private.is_member()));
create policy mark_own_messages on public.atlas_inbox for update to authenticated
  using (user_id=(select auth.uid()) and (select atlas_private.is_member()))
  with check (user_id=(select auth.uid()) and (select atlas_private.is_member()) and is_read);

-- Both admin publication paths prepend one canonical event within their transaction.
create function atlas_private.deliver_news() returns trigger
language plpgsql security definer set search_path='' as $$
declare item jsonb := new.content->'news'->0;
begin
  if item->>'kind'='转会' then
    insert into public.atlas_inbox(user_id,event)
      select user_id,item from public.atlas_follows
      where kind='player' and target_id=(item->>'player_id')::integer;
  elsif item->>'kind'='赛果' then
    insert into public.atlas_inbox(user_id,event)
      select distinct user_id,item from public.atlas_follows
      where kind='team' and target_id in ((item->>'team_a')::integer,(item->>'team_b')::integer);
  end if;
  return null;
end $$;
revoke all on function atlas_private.deliver_news() from public,anon,authenticated;
create trigger deliver_published_news after update of content on public.atlas_catalog
 for each row when (new.content->'news'->0 is distinct from old.content->'news'->0)
 execute function atlas_private.deliver_news();
alter publication supabase_realtime add table public.atlas_inbox;
