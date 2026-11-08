-- Only the project operator can populate or replace the single UUID binding.
create table atlas_private.admin_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
create table atlas_private.player_changes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor uuid not null,
  player_id integer not null,
  player_name text not null,
  previous jsonb not null,
  published jsonb not null,
  source_url text
);
revoke all on atlas_private.admin_owner, atlas_private.player_changes from public, anon, authenticated;
alter table atlas_private.admin_owner enable row level security;
alter table atlas_private.player_changes enable row level security;

create function atlas_private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select atlas_private.is_member() and exists (
    select 1 from atlas_private.admin_owner o join auth.users u on u.id=o.user_id
    where o.user_id=(select auth.uid()) and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
create function public.atlas_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select atlas_private.is_owner() $$;

create function atlas_private.admin_users(page_no integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not atlas_private.is_owner() then raise insufficient_privilege; end if;
  if page_no is null or page_no not between 0 and 100000 then raise exception 'Invalid page'; end if;
  select jsonb_build_object('total',(select count(*) from auth.users where deleted_at is null),
    'rows',coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb)) into result
  from (select u.id,u.created_at,u.last_sign_in_at,p.display_name,
    left(split_part(u.email,'@',1),2)||'***@'||split_part(u.email,'@',2) as email_hint,
    case when o.user_id is not null then 'owner' else 'member' end as role,
    case when u.banned_until>now() then 'blocked' when u.is_anonymous or u.email is null or lower(u.email) like '%.invalid' then 'legacy'
      when u.email_confirmed_at is null then 'pending' else 'verified' end as status
    from auth.users u left join public.atlas_profiles p on p.id=u.id
    left join atlas_private.admin_owner o on o.user_id=u.id where u.deleted_at is null
    order by u.created_at desc,u.id limit 25 offset (page_no*25)) r;
  return result;
end $$;
create function public.atlas_admin_users(page_no integer default 0) returns jsonb
language sql stable security invoker set search_path = '' as $$ select atlas_private.admin_users(page_no) $$;

create function atlas_private.admin_history() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not atlas_private.is_owner() then raise insufficient_privilege; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by id desc),'[]'::jsonb) from (
    select id,created_at,player_id,player_name,previous,published,source_url
    from atlas_private.player_changes order by id desc limit 50
  ) r);
end $$;
create function public.atlas_admin_history() returns jsonb
language sql stable security invoker set search_path = '' as $$ select atlas_private.admin_history() $$;

create function atlas_private.publish_player(pid integer, expected jsonb, changes jsonb, source_url text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  doc jsonb; old_row jsonb; ordinal integer; key text; v jsonb; changed_id bigint;
begin
  if not atlas_private.is_owner() then raise insufficient_privilege; end if;
  if jsonb_typeof(expected) is distinct from 'object' or jsonb_typeof(changes) is distinct from 'object'
     or changes='{}'::jsonb or pg_column_size(changes)>40000 then raise exception 'INVALID_PATCH'; end if;
  if source_url is not null and (length(source_url)>240 or source_url !~ '^https://www[.]vlr[.]gg/player/[1-9][0-9]{0,9}/[a-zA-Z0-9_%.-]+$') then raise exception 'INVALID_SOURCE'; end if;
  select content into strict doc from public.atlas_catalog where id=1 for update;
  select a,(n-1)::int into old_row,ordinal from jsonb_array_elements(doc->'player') with ordinality t(a,n) where (a->>'player_id')::int=pid;
  if old_row is null then raise exception 'UNKNOWN_PLAYER'; end if;
  if (select array_agg(k order by k) from jsonb_object_keys(expected) k) is distinct from
     (select array_agg(k order by k) from jsonb_object_keys(changes) k) then raise exception 'INVALID_PATCH'; end if;
  for key,v in select * from jsonb_each(changes) loop
    if key not in ('real_name','nationality','team_id','player_role','status','bio','vlr_url') then raise exception 'INVALID_FIELD'; end if;
    if coalesce(old_row->key,'null'::jsonb) is distinct from expected->key then raise exception 'STALE_PLAYER'; end if;
    if key='team_id' then
      if v <> 'null'::jsonb and (jsonb_typeof(v)<>'number' or not exists(select 1 from jsonb_array_elements(doc->'team') t where t->'team_id'=v))
        then raise exception 'UNKNOWN_TEAM'; end if;
    elsif jsonb_typeof(v)<>'string' or (key<>'bio' and btrim(changes->>key)='') or length(changes->>key)>(case when key='bio' then 4000 when key='vlr_url' then 240 else 120 end) then
      raise exception 'INVALID_VALUE';
    end if;
    if key='player_role' and changes->>key not in ('决斗者','先锋','控场','哨卫','自由位') then raise exception 'INVALID_ROLE'; end if;
    if key='status' and changes->>key not in ('现役','不活跃','替补','退役') then raise exception 'INVALID_STATUS'; end if;
    if key='vlr_url' and (source_url is null or source_url<>changes->>key) then raise exception 'INVALID_SOURCE'; end if;
  end loop;
  update public.atlas_catalog set content=jsonb_set(doc,array['player',ordinal::text],old_row||changes) where id=1;
  insert into atlas_private.player_changes(actor,player_id,player_name,previous,published,source_url)
    values(auth.uid(),pid,old_row->>'ign',expected,changes,source_url) returning id into changed_id;
  return changed_id;
end $$;
create function public.atlas_publish_player(pid integer,expected jsonb,changes jsonb,source_url text default null) returns bigint
language sql security invoker set search_path = '' as $$ select atlas_private.publish_player(pid,expected,changes,source_url) $$;
revoke all on function atlas_private.is_owner(),
  public.atlas_is_admin(),
  atlas_private.admin_users(integer),
  public.atlas_admin_users(integer),
  atlas_private.admin_history(),
  public.atlas_admin_history(),
  atlas_private.publish_player(integer,jsonb,jsonb,text),
  public.atlas_publish_player(integer,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function atlas_private.is_owner(),
  public.atlas_is_admin(),
  atlas_private.admin_users(integer),
  public.atlas_admin_users(integer),
  atlas_private.admin_history(),
  public.atlas_admin_history(),
  atlas_private.publish_player(integer,jsonb,jsonb,text),
  public.atlas_publish_player(integer,jsonb,jsonb,text) to authenticated;
