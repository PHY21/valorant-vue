import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Postgres permissions reject anonymous writes and cross-account comment changes", async () => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  try {
    // Reproduce the relevant hosted roles/identity interface, never actual Auth credentials.
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${alice}', '{"display_name":"Alice"}');`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202611060001_accounts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values ('${bob}', '{"display_name":"Bob"}');`,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from public.atlas_profiles"))
        .rows[0].n,
      2,
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${alice}';`,
    );
    const inserted = await db.query(
      `insert into public.atlas_comments(author_id,target,body,rating) values ($1,'player:1','Hello',5) returning id`,
      [alice],
    );
    const id = inserted.rows[0].id;
    await assert.rejects(
      db.query(
        `insert into public.atlas_comments(author_id,target,body,rating,created_at) values ($1,'player:1','Fake date',5,now())`,
        [alice],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        `insert into public.atlas_comments(author_id,target,body,rating) values ($1,'player:1',' ',5)`,
        [alice],
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.query(
        `insert into public.atlas_comments(author_id,target,body,rating) values ($1,'player:1','bad rating',6)`,
        [alice],
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.query(`select * from auth.users`),
      /permission denied/,
    );
    await db.exec(`set request.jwt.claim.sub = '${bob}';`);
    assert.equal(
      (await db.query("select * from public.atlas_comments")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        `insert into public.atlas_comments(author_id,target,body,rating) values ($1,'player:1','Impersonated',5)`,
        [alice],
      ),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query(
          "delete from public.atlas_comments where id=$1 returning id",
          [id],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("update public.atlas_comments set body=$1 where id=$2", [
        "Tampered",
        id,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update public.atlas_profiles set display_name=$1 where id=$2", [
        "Stolen",
        alice,
      ]),
      /permission denied/,
    );
    await db.exec(`set role anon; set request.jwt.claim.sub = '';`);
    assert.equal(
      (await db.query("select * from public.atlas_comments")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        `insert into public.atlas_comments(author_id,target,body,rating) values ($1,'player:1','Anonymous',5)`,
        [alice],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("delete from public.atlas_comments"),
      /permission denied/,
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${alice}';`,
    );
    assert.equal(
      (
        await db.query(
          "delete from public.atlas_comments where id=$1 returning id",
          [id],
        )
      ).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
