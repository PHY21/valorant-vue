-- Dashboard browsing views: read the live catalog without copying any rows.

create view public."赛区" with (security_invoker = true) as
select r.region_id as "赛区编号",
       r.region_name as "赛区名称",
       r.region_code as "赛区简称",
       r.description as "说明",
       r.logo_url as "标志地址"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'region') as r(
  region_id int, region_name text, region_code text, description text, logo_url text
)
where c.id=1;

create view public."战队" with (security_invoker = true) as
select r.team_id as "战队编号",
       r.team_name as "战队名称",
       r.team_tag as "简称",
       r.region_id as "赛区编号",
       v0."赛区名称" as "赛区名称",
       r.founded_year as "成立年份",
       r.honors as "荣誉",
       r.description as "简介",
       r.logo_url as "标志地址"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'team') as r(
  team_id int, team_name text, team_tag text, region_id int, founded_year int, honors text, description text, logo_url text
)
left join public."赛区" v0 on v0."赛区编号"=r.region_id
where c.id=1;

create view public."选手" with (security_invoker = true) as
select r.player_id as "选手编号",
       r.ign as "比赛ID",
       r.real_name as "姓名",
       r.team_id as "战队编号",
       v0."战队名称" as "战队名称",
       r.nationality as "国家或地区",
       r.player_role as "定位",
       r.status as "状态",
       r.birth_date as "生日",
       r.bio as "简介",
       r.photo_url as "照片地址",
       r.vlr_url as "资料来源"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'player') as r(
  player_id int, ign text, real_name text, team_id int, nationality text, player_role text, status text, birth_date date, bio text, photo_url text, vlr_url text
)
left join public."战队" v0 on v0."战队编号"=r.team_id
where c.id=1;

create view public."赛事" with (security_invoker = true) as
select r.tournament_id as "赛事编号",
       r.tournament_name as "赛事名称",
       r.tournament_year as "年份",
       r.tournament_level as "级别",
       r.start_date as "开始日期",
       r.end_date as "结束日期",
       r.prize_pool as "奖金池"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'tournament') as r(
  tournament_id int, tournament_name text, tournament_year int, tournament_level text, start_date date, end_date date, prize_pool numeric
)
where c.id=1;

create view public."特工" with (security_invoker = true) as
select r.agent_id as "特工编号",
       r.agent_name as "特工名称",
       r.agent_role as "定位",
       r.origin as "来自",
       r.description as "简介",
       r.skills as "技能概要",
       r.video_url as "视频地址",
       r.icon_url as "图标地址",
       r.abilities as "详细技能"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'agent') as r(
  agent_id int, agent_name text, agent_role text, origin text, description text, skills text, video_url text, icon_url text, abilities jsonb
)
where c.id=1;

create view public."选手常用特工" with (security_invoker = true) as
select r.id as "编号",
       r.player_id as "选手编号",
       v0."比赛ID" as "比赛ID",
       r.agent_id as "特工编号",
       v1."特工名称" as "特工名称",
       r.proficiency as "熟练度",
       r.is_signature as "招牌标记"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'player_agent') as r(
  id int, player_id int, agent_id int, proficiency numeric, is_signature int
)
left join public."选手" v0 on v0."选手编号"=r.player_id
left join public."特工" v1 on v1."特工编号"=r.agent_id
where c.id=1;

create view public."选手赛事成绩" with (security_invoker = true) as
select r.stat_id as "成绩编号",
       r.player_id as "选手编号",
       v0."比赛ID" as "比赛ID",
       r.team_id as "当届战队编号",
       v1."战队名称" as "当届战队",
       r.tournament_id as "赛事编号",
       v2."赛事名称" as "赛事名称",
       r.agent_id as "特工编号",
       v3."特工名称" as "特工名称",
       r.matches_played as "场次",
       r.kills as "击杀",
       r.deaths as "死亡",
       r.assists as "助攻",
       r.acs as "ACS",
       r.kd as "KD",
       r.rating as "Rating"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'player_tournament_stats') as r(
  stat_id int, player_id int, team_id int, tournament_id int, agent_id int, matches_played int, kills int, deaths int, assists int, acs numeric, kd numeric, rating numeric
)
left join public."选手" v0 on v0."选手编号"=r.player_id
left join public."战队" v1 on v1."战队编号"=r.team_id
left join public."赛事" v2 on v2."赛事编号"=r.tournament_id
left join public."特工" v3 on v3."特工编号"=r.agent_id
where c.id=1;

create view public."战队赛事成绩" with (security_invoker = true) as
select r.id as "编号",
       r.team_id as "战队编号",
       v0."战队名称" as "战队名称",
       r.tournament_id as "赛事编号",
       v1."赛事名称" as "赛事名称",
       r.placement as "名次",
       r.wins as "胜场",
       r.losses as "负场"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'team_tournament') as r(
  id int, team_id int, tournament_id int, placement text, wins int, losses int
)
left join public."战队" v0 on v0."战队编号"=r.team_id
left join public."赛事" v1 on v1."赛事编号"=r.tournament_id
where c.id=1;

create view public."比赛交手记录" with (security_invoker = true) as
select r.id as "比赛编号",
       r.date as "比赛日期",
       r.team_a as "甲队编号",
       v0."战队名称" as "甲队",
       r.score_a as "甲队比分",
       r.score_b as "乙队比分",
       r.team_b as "乙队编号",
       v1."战队名称" as "乙队",
       r.stage as "轮次",
       r.tournament_id as "赛事编号",
       v2."赛事名称" as "赛事名称",
       r.event_name as "录入赛事名",
       r.revision as "更正版本"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'team_matches') as r(
  id int, date date, team_a int, score_a int, score_b int, team_b int, stage text, tournament_id int, event_name text, revision int
)
left join public."战队" v0 on v0."战队编号"=r.team_a
left join public."战队" v1 on v1."战队编号"=r.team_b
left join public."赛事" v2 on v2."赛事编号"=r.tournament_id
where c.id=1;

create view public."赛场动态" with (security_invoker = true) as
select r.at as "发布时间",
       r.kind as "类型",
       r.title as "标题",
       r.detail as "说明",
       r.player_id as "选手编号",
       r.team_a as "甲队编号",
       r.team_b as "乙队编号",
       r.match_id as "比赛编号"
from public.atlas_catalog c
cross join lateral jsonb_to_recordset(c.content->'news') as r(
  at timestamptz, kind text, title text, detail text, player_id int, team_a int, team_b int, match_id int
)
where c.id=1;

create view public."特工技能" with (security_invoker=true) as
select a."特工编号", a."特工名称", s.name as "技能名称", s.english as "英文名称",
       s.description as "技能说明", s.clip as "演示视频"
from public."特工" a
cross join lateral jsonb_to_recordset(a."详细技能") as s(name text, english text, description text, clip text);

-- These convenience views are for the project dashboard, not additional client API endpoints.
revoke all on public."赛区",
  public."战队",
  public."选手",
  public."赛事",
  public."特工",
  public."选手常用特工",
  public."选手赛事成绩",
  public."战队赛事成绩",
  public."比赛交手记录",
  public."赛场动态",
  public."特工技能" from public, anon, authenticated;
