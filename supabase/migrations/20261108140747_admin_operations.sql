-- The site owner controls delegation. Every content operation checks the current database role.
create table atlas_private.editors(user_id uuid primary key references auth.users(id) on delete cascade);
create table atlas_private.operations(id bigint generated always as identity primary key,
 created_at timestamptz not null default now(), actor uuid not null, action text not null, detail text not null);
alter table atlas_private.editors enable row level security;
alter table atlas_private.operations enable row level security;
revoke all on atlas_private.editors,atlas_private.operations from public,anon,authenticated;

create function atlas_private.can_manage() returns boolean language sql stable security definer set search_path='' as $$
 select atlas_private.is_owner() or (atlas_private.is_member() and exists (
 select 1 from atlas_private.editors e join auth.users u on u.id=e.user_id
 where e.user_id=auth.uid() and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())));
$$;
create or replace function public.atlas_is_admin() returns boolean language sql stable security invoker set search_path='' as $$select atlas_private.can_manage()$$;
create function public.atlas_is_owner() returns boolean language sql stable security invoker set search_path='' as $$select atlas_private.is_owner()$$;

create or replace function atlas_private.admin_users(page_no integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not atlas_private.is_owner() then raise insufficient_privilege; end if;
  if page_no is null or page_no not between 0 and 100000 then raise exception 'Invalid page'; end if;
  select jsonb_build_object('total',(select count(*) from auth.users where deleted_at is null),
    'rows',coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb)) into result
  from (select u.id,u.created_at,u.last_sign_in_at,p.display_name,
    left(split_part(u.email,'@',1),2)||'***@'||split_part(u.email,'@',2) as email_hint,
    case when o.user_id is not null then 'owner' when exists(select 1 from atlas_private.editors e where e.user_id=u.id) then 'admin' else 'member' end as role,
    case when u.banned_until>now() then 'blocked' when u.is_anonymous or u.email is null or lower(u.email) like '%.invalid' then 'legacy'
      when u.email_confirmed_at is null then 'pending' else 'verified' end as status
    from auth.users u left join public.atlas_profiles p on p.id=u.id
    left join atlas_private.admin_owner o on o.user_id=u.id where u.deleted_at is null
    order by u.created_at desc,u.id limit 25 offset (page_no*25)) r;
  return result;
end $$;
create or replace function atlas_private.admin_history() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not atlas_private.can_manage() then raise insufficient_privilege; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by id desc),'[]'::jsonb) from (
    select id,created_at,player_id,player_name,previous,published,source_url
    from atlas_private.player_changes order by id desc limit 50
  ) r);
end $$;
create or replace function atlas_private.publish_player(pid integer, expected jsonb, changes jsonb, source_url text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  doc jsonb; old_row jsonb; ordinal integer; key text; v jsonb; changed_id bigint;
begin
  if not atlas_private.can_manage() then raise insufficient_privilege; end if;
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
create function atlas_private.set_editor(target_id uuid, enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare label text;
begin
 if not atlas_private.is_owner() then raise insufficient_privilege; end if;
 if enabled is null or exists(select 1 from atlas_private.admin_owner where user_id=target_id) then raise exception 'PROTECTED_OWNER'; end if;
 select coalesce(p.display_name,'网站账号') into label from auth.users u left join public.atlas_profiles p on p.id=u.id
 where u.id=target_id and (not enabled or (u.deleted_at is null and not coalesce(u.is_anonymous,false)
 and u.email_confirmed_at is not null and u.email is not null and lower(u.email) not like '%.invalid' and (u.banned_until is null or u.banned_until<=now()))) for update of u;
 if not found then raise exception 'INVALID_ACCOUNT'; end if;
 if enabled then insert into atlas_private.editors values(target_id) on conflict do nothing;
 else delete from atlas_private.editors where user_id=target_id; end if;
 if found then insert into atlas_private.operations(actor,action,detail) values(auth.uid(),case when enabled then '授予管理员' else '撤销管理员' end,label||' · '||left(target_id::text,8)); end if;
end $$;
create function atlas_private.remove_comment(comment_id uuid, reason text) returns void
language plpgsql security definer set search_path='' as $$
declare target_name text;
begin
 if not atlas_private.can_manage() then raise insufficient_privilege; end if;
 if reason is null or length(trim(reason)) not between 1 and 200 then raise exception 'INVALID_REASON'; end if;
 delete from public.atlas_comments where id=comment_id returning target into target_name;
 if not found then raise exception 'COMMENT_GONE'; end if;
 insert into atlas_private.operations(actor,action,detail) values(auth.uid(),'删除评论',target_name||' · '||left(comment_id::text,8)||' · 原因：'||trim(reason));
end $$;
create function atlas_private.operation_history() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not atlas_private.can_manage() then raise insufficient_privilege; end if;
 return (select coalesce(jsonb_agg(to_jsonb(r) order by r.id desc),'[]') from
 (select o.id,o.created_at,o.action,o.detail,coalesce(p.display_name,'管理员') as actor_name from atlas_private.operations o left join public.atlas_profiles p on p.id=o.actor order by o.id desc limit 50) r);
end $$;

-- Keep member-visible news separate from private moderation and role history.
create function atlas_private.with_news(doc jsonb, item jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_set(doc,'{news}',jsonb_build_array(item)||coalesce((select jsonb_agg(v order by n) from jsonb_array_elements(doc->'news') with ordinality a(v,n) where n<=49),'[]'));
$$;
create function atlas_private.transfer_news() returns trigger language plpgsql security definer set search_path='' as $$
declare doc jsonb; old_team text; new_team text;
begin
 if new.published ? 'team_id' and new.previous->'team_id' is distinct from new.published->'team_id' then
 select content into strict doc from public.atlas_catalog where id=1 for update;
 select t->>'team_name' into old_team from jsonb_array_elements(doc->'team') t where t->'team_id'=new.previous->'team_id';
 select t->>'team_name' into new_team from jsonb_array_elements(doc->'team') t where t->'team_id'=new.published->'team_id';
 update public.atlas_catalog set content=atlas_private.with_news(doc,jsonb_build_object('kind','转会','at',now(),'title',new.player_name||'：'||coalesce(old_team,'自由选手')||' → '||coalesce(new_team,'自由选手'),'player_id',new.player_id)) where id=1;
 end if;
 return new;
end $$;
create trigger transfer_news after insert on atlas_private.player_changes for each row execute function atlas_private.transfer_news();

create function atlas_private.add_match(a int,b int,sa int,sb int,played date,event_name text,stage_name text,vlr_id int)
returns void language plpgsql security definer set search_path='' as $$
declare doc jsonb; mid int; an text; bn text; title text; tournament int;
begin
 if not atlas_private.can_manage() then raise insufficient_privilege; end if;
 if a is null or b is null or a=b or sa is null or sb is null or least(sa,sb)<0 or greatest(sa,sb)>3 or sa=sb
 or played is null or played<date '2020-01-01' or played>(now() at time zone 'Asia/Shanghai')::date
 or event_name is null or length(trim(event_name)) not between 1 and 120 or stage_name is null or length(trim(stage_name)) not between 1 and 100
 or vlr_id<=0 then raise exception 'INVALID_MATCH'; end if;
 select content into strict doc from public.atlas_catalog where id=1 for update;
 select t->>'team_name' into an from jsonb_array_elements(doc->'team') t where (t->>'team_id')::int=a;
 select t->>'team_name' into bn from jsonb_array_elements(doc->'team') t where (t->>'team_id')::int=b;
 if an is null or bn is null then raise exception 'UNKNOWN_TEAM'; end if;
 if exists(select 1 from jsonb_array_elements(doc->'team_matches') m where (m->>'id')::int=vlr_id or
 (m->>'date'=played::text and least((m->>'team_a')::int,(m->>'team_b')::int)=least(a,b) and greatest((m->>'team_a')::int,(m->>'team_b')::int)=greatest(a,b)
 and lower(m->>'stage')=lower(trim(stage_name)) and (m->>'event_name'=trim(event_name) or exists(select 1 from jsonb_array_elements(doc->'tournament') t where t->'tournament_id'=m->'tournament_id' and t->>'tournament_name'=trim(event_name))))) then raise exception 'DUPLICATE_MATCH'; end if;
 select (t->>'tournament_id')::int into tournament from jsonb_array_elements(doc->'tournament') t where t->>'tournament_name'=trim(event_name) limit 1;
 select coalesce(vlr_id,least(coalesce(min((m->>'id')::int),0),0)-1) into mid from jsonb_array_elements(doc->'team_matches') m;
 doc=jsonb_set(doc,'{team_matches}',coalesce(doc->'team_matches','[]')||jsonb_build_array(jsonb_build_object('id',mid,'team_a',a,'team_b',b,'score_a',sa,'score_b',sb,'date',played,'event_name',trim(event_name),'tournament_id',tournament,'stage',trim(stage_name))));
 title=an||' '||sa||' : '||sb||' '||bn;
 update public.atlas_catalog set content=atlas_private.with_news(doc,jsonb_build_object('kind','赛果','at',now(),'title',title,'detail',played||' · '||trim(event_name)||' · '||trim(stage_name),'team_a',a,'team_b',b)) where id=1;
 insert into atlas_private.operations(actor,action,detail) values(auth.uid(),'发布赛果',title||' · '||played||' · '||trim(event_name));
end $$;
create function public.atlas_set_editor(target_id uuid,enabled boolean) returns void language sql security invoker set search_path='' as $$select atlas_private.set_editor(target_id,enabled)$$;
create function public.atlas_remove_comment(comment_id uuid,reason text) returns void language sql security invoker set search_path='' as $$select atlas_private.remove_comment(comment_id,reason)$$;
create function public.atlas_operation_history() returns jsonb language sql security invoker set search_path='' as $$select atlas_private.operation_history()$$;
create function public.atlas_add_match(a int,b int,sa int,sb int,played date,event_name text,stage_name text,vlr_id int) returns void language sql security invoker set search_path='' as $$select atlas_private.add_match(a,b,sa,sb,played,event_name,stage_name,vlr_id)$$;
revoke all on function public.atlas_is_owner(),atlas_private.can_manage(),atlas_private.set_editor(uuid,boolean),public.atlas_set_editor(uuid,boolean),atlas_private.remove_comment(uuid,text),public.atlas_remove_comment(uuid,text),atlas_private.operation_history(),public.atlas_operation_history(),atlas_private.add_match(int,int,int,int,date,text,text,int),public.atlas_add_match(int,int,int,int,date,text,text,int),atlas_private.transfer_news(),atlas_private.with_news(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_is_owner(),atlas_private.can_manage(),atlas_private.set_editor(uuid,boolean),public.atlas_set_editor(uuid,boolean),atlas_private.remove_comment(uuid,text),public.atlas_remove_comment(uuid,text),atlas_private.operation_history(),public.atlas_operation_history(),atlas_private.add_match(int,int,int,int,date,text,text,int),public.atlas_add_match(int,int,int,int,date,text,text,int) to authenticated;
