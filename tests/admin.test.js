import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  profileUrl,
  parseProfile,
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
test("owner-only RPCs reject other identities, serialize stale edits and log only committed changes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema atlas_private;
 create table auth.users(id uuid primary key, email text,email_confirmed_at timestamptz,is_anonymous boolean default false,deleted_at timestamptz,banned_until timestamptz,created_at timestamptz default now(),last_sign_in_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,atlas_private to authenticated;
 create table public.atlas_profiles(id uuid primary key,display_name text);
 create table public.atlas_catalog(id int primary key,content jsonb);
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
