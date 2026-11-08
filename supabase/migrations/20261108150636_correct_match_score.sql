create or replace function atlas_private.add_match(a int,b int,sa int,sb int,played date,event_name text,stage_name text,vlr_id int)
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
 update public.atlas_catalog set content=atlas_private.with_news(doc,jsonb_build_object('kind','赛果','match_id',mid,'at',now(),'title',title,'detail',played||' · '||trim(event_name)||' · '||trim(stage_name),'team_a',a,'team_b',b)) where id=1;
 insert into atlas_private.operations(actor,action,detail) values(auth.uid(),'发布赛果',title||' · '||played||' · '||trim(event_name));
end $$;

-- The catalog row lock serializes score corrections with new match publication.
create function atlas_private.correct_match(mid integer, expected_a integer, expected_b integer,
  expected_revision integer, new_a integer, new_b integer, reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare
  doc jsonb; game jsonb; position_idx integer; revision integer;
  team_a_name text; team_b_name text; tournament_name text; match_detail text;
  old_score text; new_score text; original_title text; corrected_title text;
  notice jsonb; notified integer;
begin
  if not atlas_private.can_manage() then raise insufficient_privilege; end if;
  if new_a is null or new_b is null or least(new_a,new_b)<0 or greatest(new_a,new_b)>3
     or new_a=new_b or reason is null or length(btrim(reason)) not between 1 and 200
     then raise exception 'INVALID_CORRECTION'; end if;
  select content into strict doc from public.atlas_catalog where id=1 for update;
  select item,(n-1)::integer into game,position_idx
    from jsonb_array_elements(doc->'team_matches') with ordinality as entries(item,n)
    where (item->>'id')::integer=mid;
  if game is null then raise exception 'UNKNOWN_MATCH'; end if;
  revision=coalesce((game->>'revision')::integer,0);
  if expected_a is distinct from (game->>'score_a')::int
    or expected_b is distinct from (game->>'score_b')::int or expected_revision is distinct from revision
    then raise exception 'STALE_MATCH'; end if;
  if expected_a=new_a and expected_b=new_b then raise exception 'UNCHANGED_SCORE'; end if;
  select t->>'team_name' into strict team_a_name from jsonb_array_elements(doc->'team') t where t->'team_id'=game->'team_a';
  select t->>'team_name' into strict team_b_name from jsonb_array_elements(doc->'team') t where t->'team_id'=game->'team_b';
  select t->>'tournament_name' into tournament_name from jsonb_array_elements(doc->'tournament') t where t->'tournament_id'=game->'tournament_id';
  match_detail=concat_ws(' · ',game->>'date',coalesce(game->>'event_name',tournament_name),game->>'stage');
  old_score=expected_a||' : '||expected_b;
  new_score=new_a||' : '||new_b;
  original_title=team_a_name||' '||old_score||' '||team_b_name;
  corrected_title=team_a_name||' '||new_score||' '||team_b_name;
  notice=jsonb_build_object('kind','赛果更正','at',now(),'match_id',mid,'team_a',game->'team_a',
    'team_b',game->'team_b','title',corrected_title,'detail',match_detail||' · '||old_score||' → '||new_score||' · '||btrim(reason));
  doc=jsonb_set(doc,array['team_matches',position_idx::text],game||jsonb_build_object('score_a',new_a,'score_b',new_b,'revision',revision+1));
  -- A legacy publication can be identified by its original teams, dated event/stage and original score.
  doc=jsonb_set(doc,'{news}',coalesce((select jsonb_agg(item order by n)
    from jsonb_array_elements(doc->'news') with ordinality as feed(item,n)
    where not (item @> jsonb_build_object('match_id',mid)
      or (not item ? 'match_id' and item @> jsonb_build_object('kind','赛果','title',original_title,'detail',match_detail,'team_a',game->'team_a','team_b',game->'team_b')))),'[]'));
  update public.atlas_catalog set content=atlas_private.with_news(doc,notice) where id=1;
  -- Mark prior messages in place without changing their read state. Reuse original recipients even after unfollowing.
  update public.atlas_inbox set event=event||jsonb_build_object('match_id',mid,'superseded_by',corrected_title)
    where (event->>'kind' in ('赛果','赛果更正') and event @> jsonb_build_object('match_id',mid))
    or (not event ? 'match_id' and event @> jsonb_build_object('kind','赛果','title',original_title,'detail',match_detail,'team_a',game->'team_a','team_b',game->'team_b'));
  insert into public.atlas_inbox(user_id,event)
    select distinct user_id,notice from public.atlas_inbox
    where event @> jsonb_build_object('kind','赛果','match_id',mid);
  get diagnostics notified=row_count;
  insert into atlas_private.operations(actor,action,detail) values(auth.uid(),'更正赛果',
    match_detail||' · #'||mid||' · '||original_title||' → '||corrected_title||' · '||btrim(reason));
  return notified;
end $$;

create function public.atlas_correct_match(mid integer, expected_a integer, expected_b integer,
 expected_revision integer, new_a integer, new_b integer, reason text)
returns integer language sql security invoker set search_path='' as $$
 select atlas_private.correct_match(mid,expected_a,expected_b,expected_revision,new_a,new_b,reason);
$$;
revoke all on function atlas_private.correct_match(integer,integer,integer,integer,integer,integer,text),
 public.atlas_correct_match(integer,integer,integer,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function atlas_private.correct_match(integer,integer,integer,integer,integer,integer,text),
 public.atlas_correct_match(integer,integer,integer,integer,integer,integer,text) to authenticated;
