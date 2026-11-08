import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  profileUrl,
  parseProfile,
  lookupUrl,
  searchPlayers,
} from "../supabase/functions/atlas-vlr-preview/profile.mjs";
import { sourceProposal } from "../src/lib/admin.js";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  member = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
test("VLR accepts only a player URL and matches identity and current team before suggesting changes", () => {
  for (const url of [
    "http://169.254.169.254",
    "https://www.vlr.gg.evil.com/player/1/name",
    "https://www.vlr.gg/player/2/../secret",
    "https://user@www.vlr.gg/player/1/name",
  ])
    assert.equal(profileUrl(url), null);
  const url = "https://www.vlr.gg/player/1/name";
  const html =
    '<link rel="canonical" href="' +
    url +
    '"><h1 class="wf-title">Name</h1><h2 class="player-real-name">New Name</h2><i class="flag mod-cn"></i><div class="wf-nav"><h2>Current Teams</h2><a href="/team/4/a"><div style="font-weight: 500;">Current</div></a><h2>Past Teams</h2><a href="/team/3/b"><div style="font-weight: 500;">Past</div></a>';
  const result = parseProfile(html, url);
  assert.deepEqual(result.teams, ["Current"]);
  assert.throws(
    () => sourceProposal({ ign: "different" }, result, []),
    /不一致/,
  );
  assert.equal(
    sourceProposal({ ign: "NAME" }, result, [
      { team_id: 4, team_name: "CURRENT", team_tag: "CUR" },
    ]).values.team_id,
    4,
  );
  assert.equal(
    sourceProposal({ ign: "Name" }, { ...result, teams: [] }, []).values
      .team_id,
    undefined,
  );
});
test("owner delegates and revokes; editors publish and moderate but cannot grant; stale or duplicate updates leave no changes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema atlas_private;
 create table auth.users(id uuid primary key, email text,email_confirmed_at timestamptz,is_anonymous boolean default false,deleted_at timestamptz,banned_until timestamptz,created_at timestamptz default now(),last_sign_in_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,atlas_private to authenticated;
 create table public.atlas_profiles(id uuid primary key,display_name text);
 create table public.atlas_comments(id uuid primary key,target text);\n create table public.atlas_catalog(id int primary key,content jsonb);
 create function atlas_private.is_member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)$$;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${owner}','owner@example.org',now(),'{}'),('${member}','member@example.org',now(),'{"role":"admin"}');
 insert into public.atlas_catalog values(1,'{"player":[{"player_id":1,"ign":"A","team_id":2,"bio":"old"}],"team":[{"team_id":2}],"other":[1]}');`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261108134330_admin_console.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261108140747_admin_operations.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("create publication supabase_realtime");
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261108144612_favorite_inbox.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261108150636_correct_match_score.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `insert into atlas_private.admin_owner(user_id) values('${owner}'); set role anon;`,
    );
    await assert.rejects(
      db.query("select public.atlas_admin_users(0)"),
      /permission denied/,
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${member}'`,
    );
    assert.equal(
      (await db.query("select public.atlas_is_admin() flag")).rows[0].flag,
      false,
    );
    for (const sql of [
      "select public.atlas_admin_users(0)",
      "select public.atlas_admin_history()",
      "select public.atlas_publish_player(1,'{}','{}')",
      "select * from atlas_private.admin_owner",
      "update public.atlas_catalog set content='{}'",
    ])
      await assert.rejects(db.query(sql), (err) => err.code === "42501");
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    assert.equal(
      (await db.query("select public.atlas_is_admin() flag")).rows[0].flag,
      true,
    );
    const users = (await db.query("select public.atlas_admin_users(0) u"))
      .rows[0].u;
    assert.equal(users.total, 2);
    assert.equal(users.rows.filter((r) => r.role === "owner").length, 1);
    assert.ok(users.rows.every((r) => r.email_hint.includes("***@")));
    const update =
      'select public.atlas_publish_player(1, \'{"bio":"old"}\', \'{"bio":"new"}\')';
    await db.query(update);
    await assert.rejects(db.query(update), /STALE_PLAYER/);
    await assert.rejects(
      db.query(
        'select public.atlas_publish_player(1,\'{"bio":"new","team_id":2}\',\'{"bio":"bad","team_id":99}\')',
      ),
      /UNKNOWN_TEAM/,
    );
    await assert.rejects(
      db.query(
        "select public.atlas_publish_player(1,'{\"is_admin\":null}','{\"is_admin\":true}')",
      ),
      /INVALID_FIELD/,
    );
    const log = (await db.query("select public.atlas_admin_history() h"))
      .rows[0].h;
    assert.equal(log.length, 1);
    assert.deepEqual(log[0].previous, { bio: "old" });
    assert.deepEqual(log[0].published, { bio: "new" });
    await db.exec("reset role");
    const doc = (await db.query("select content from public.atlas_catalog"))
      .rows[0].content;
    assert.equal(doc.player[0].bio, "new");
    assert.deepEqual(doc.other, [1]);
    await db.exec(
      `update public.atlas_catalog set content=jsonb_set(content,'{team}','[{"team_id":2,"team_name":"Alpha"},{"team_id":3,"team_name":"Beta"}]'); insert into public.atlas_comments values('${owner}','player:1');set role authenticated;set request.jwt.claim.sub='${member}'`,
    );
    const add =
      "select public.atlas_add_match(2,3,2,1,'2025-03-04','Open','Final',null)";
    const correct =
      "select public.atlas_correct_match(-1,2,1,0,1,2,'比分填反') as recipients";
    const del = `select public.atlas_remove_comment('${owner}','辱骂')`;
    const grant = "select public.atlas_set_editor('" + member + "',true)";
    for (const q of [
      add,
      correct,
      del,
      grant,
      "select public.atlas_operation_history()",
    ])
      await assert.rejects(db.query(q), (e) => e.code === "42501");
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    await db.query(grant);
    await assert.rejects(
      db.query(`select public.atlas_set_editor('${owner}',false)`),
      /PROTECTED_OWNER/,
    );
    assert.equal(
      (
        await db.query("select public.atlas_admin_users(0) d")
      ).rows[0].d.rows.find((u) => u.id === member).role,
      "admin",
    );
    await db.exec(`set request.jwt.claim.sub='${member}'`);
    assert.equal(
      (await db.query("select public.atlas_is_admin() a")).rows[0].a,
      true,
    );
    for (const q of [
      grant,
      "select public.atlas_admin_users(0)",
      "select * from atlas_private.editors",
    ])
      await assert.rejects(db.query(q), (e) => e.code === "42501");
    await assert.rejects(
      db.query(add.replace("2,3,2,1", "2,2,2,1")),
      /INVALID_MATCH/,
    );
    await db.exec(
      "insert into public.atlas_follows(kind,target_id) values ('team',2),('team',3),('player',1)",
    );
    await assert.rejects(
      db.query(
        `insert into public.atlas_follows(user_id,kind,target_id) values ('${owner}','player',1)`,
      ),
      (e) => e.code === "42501",
    );
    await db.query(add);
    await assert.rejects(db.query(add), /DUPLICATE_MATCH/);
    await db.query(
      `select public.atlas_publish_player(1,'{"team_id":2}','{"team_id":3}')`,
    );
    const inbox = () =>
      db.query("select id,event,is_read from public.atlas_inbox order by id");
    const delivered = (await inbox()).rows;
    assert.deepEqual(
      delivered.map((m) => m.event.kind),
      ["赛果", "转会"],
    );
    assert.ok(delivered.every((m) => !m.is_read));
    await db.query("update public.atlas_inbox set is_read=true where id=$1", [
      delivered[0].id,
    ]);
    await assert.rejects(
      db.query("update public.atlas_inbox set event='{}'"),
      (e) => e.code === "42501",
    );
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    assert.equal((await inbox()).rows.length, 0);
    assert.equal(
      (
        await db.query(
          "update public.atlas_inbox set is_read=true returning id",
        )
      ).rows.length,
      0,
    );
    await db.exec(`set request.jwt.claim.sub='${member}'`);
    assert.equal((await inbox()).rows[0].is_read, true);
    await db.exec("delete from public.atlas_follows where kind='player'");
    await db.query(
      `select public.atlas_publish_player(1,'{"team_id":3}','{"team_id":2}')`,
    );
    assert.equal((await inbox()).rows.length, 2);
    await db.query(del);
    await assert.rejects(db.query(del), /COMMENT_GONE/);
    await db.exec("reset role");
    const changed = (await db.query("select content from public.atlas_catalog"))
      .rows[0].content;
    assert.equal(changed.news.length, 3);
    assert.match(changed.news[1].title, /Alpha → Beta/);
    assert.equal(changed.team_matches[0].score_a, 2);
    assert.equal(changed.team_matches[0].id, -1);
    assert.equal(
      (await db.query("select count(*)::int n from public.atlas_comments"))
        .rows[0].n,
      0,
    );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${owner}'`,
    );
    // A new follower should not receive a correction to someone else's earlier notification.
    await db.exec(
      "insert into public.atlas_follows(kind,target_id) values ('team',2)",
    );
    await db.exec(
      `set request.jwt.claim.sub='${member}';delete from public.atlas_follows where kind='team'`,
    );
    await assert.rejects(
      db.query(correct.replace("0,1,2", "0,1,1")),
      /INVALID_CORRECTION/,
    );
    await assert.rejects(
      db.query(correct.replace("0,1,2", "0,2,1")),
      /UNCHANGED_SCORE/,
    );
    assert.equal((await db.query(correct)).rows[0].recipients, 1);
    await assert.rejects(db.query(correct), /STALE_MATCH/);
    const corrected = (await inbox()).rows;
    assert.equal(corrected.length, 3);
    assert.equal(corrected[0].is_read, true);
    assert.match(corrected[0].event.superseded_by, /Alpha 1 : 2 Beta/);
    assert.equal(corrected[2].is_read, false);
    assert.equal(corrected[2].event.kind, "赛果更正");
    assert.match(corrected[2].event.detail, /2 : 1 → 1 : 2.*比分填反/);
    await db.exec("reset role");
    const correctedDoc = (
      await db.query("select content from public.atlas_catalog")
    ).rows[0].content;
    assert.equal(correctedDoc.team_matches.length, 1);
    assert.deepEqual(
      [
        correctedDoc.team_matches[0].score_a,
        correctedDoc.team_matches[0].score_b,
        correctedDoc.team_matches[0].revision,
      ],
      [1, 2, 1],
    );
    assert.equal(correctedDoc.news[0].kind, "赛果更正");
    assert.ok(!correctedDoc.news.some((row) => row.kind === "赛果"));
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${owner}'`,
    );
    assert.equal((await inbox()).rows.length, 0);
    await db.query(`select public.atlas_set_editor('${member}',false)`);
    await db.exec(`set request.jwt.claim.sub='${member}'`);
    await assert.rejects(db.query(add), (e) => e.code === "42501");
    await db.exec(`reset role;set request.jwt.claim.sub='${owner}'`);
    await db.exec(
      `update auth.users set banned_until=now()+interval '1 hour' where id='${owner}'; set role authenticated`,
    );
    assert.equal(
      (await db.query("select public.atlas_is_admin() flag")).rows[0].flag,
      false,
    );
  } finally {
    await db.close();
  }
});

test("Smoggy search links resolve to distinct players, never to arbitrary upstream hosts", () => {
  const search = "https://www.vlr.gg/search/?q=Smoggy";
  assert.equal(lookupUrl(search), search);
  assert.equal(
    lookupUrl("vlr.gg/player/4742/smoggy/?tab=overview"),
    "https://www.vlr.gg/player/4742/smoggy",
  );
  for (const invalid of [
    "https://vlr.gg.evil.net/search/?q=x",
    "https://www.vlr.gg@evil.net/search/?q=x",
    "https://www.vlr.gg/team/5/test",
  ])
    assert.equal(lookupUrl(invalid), null);
  const html = [4742, 5985]
    .map(
      (id) =>
        '<a href="/search/r/player/' +
        id +
        '/idx"><div class="search-item-title">Smoggy</div></a>',
    )
    .join("");
  assert.deepEqual(
    searchPlayers(html).map((r) => r.url),
    [4742, 5985].map((id) => "https://www.vlr.gg/player/" + id + "/smoggy"),
  );
});
