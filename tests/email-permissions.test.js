import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("email migration gates catalog/comments by verified real email and preserves legacy records", async () => {
  const db = new PGlite();
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
  ];
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,is_anonymous boolean default false);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to anon,authenticated;
   grant execute on function auth.uid() to anon,authenticated;`);
    for (const file of [
      "202611060001_accounts.sql",
      "202611060002_username_accounts.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `insert into auth.users values('${ids[0]}','atlas.old@accounts.invalid','{"username":"old"}',now(),false);`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261106143314_email_membership.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(`insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
   ('${ids[1]}','alice@qq.com','{"display_name":"Alice"}',now()),
   ('${ids[2]}','pending@qq.com','{}',null),
   ('${ids[3]}','bob@qq.com','{}',now());
   insert into public.atlas_catalog values(1,'{"player":[]}');`);
    await assert.rejects(
      db.exec(
        `insert into auth.users(id,email) values(gen_random_uuid(),'atlas.new@accounts.invalid')`,
      ),
      /email/i,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from public.atlas_catalog"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from public.atlas_comments"),
      /permission denied/,
    );
    for (const id of [ids[0], ids[2]]) {
      await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);
      assert.equal(
        (await db.query("select * from public.atlas_catalog")).rows.length,
        0,
      );
      await assert.rejects(
        db.exec(
          `insert into public.atlas_comments(author_id,target,body,rating) values('${id}','player:1','blocked',5)`,
        ),
        /row-level security/,
      );
    }
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${ids[1]}'`,
    );
    assert.equal(
      (await db.query("select * from public.atlas_catalog")).rows.length,
      1,
    );
    const comment = await db.query(
      `insert into public.atlas_comments(author_id,target,body,rating) values('${ids[1]}','player:1','hello',5) returning id`,
    );
    await db.exec(`set request.jwt.claim.sub='${ids[3]}'`);
    assert.equal(
      (await db.query("select * from public.atlas_comments")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("delete from public.atlas_comments returning id")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.exec(
        `insert into public.atlas_comments(author_id,target,body,rating) values('${ids[1]}','player:1','fake',5)`,
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(`update public.atlas_catalog set content='{}'`),
      /permission denied/,
    );
    await db.exec(`set request.jwt.claim.sub='${ids[1]}'`);
    assert.equal(
      (
        await db.query(
          "delete from public.atlas_comments where id=$1 returning id",
          [comment.rows[0].id],
        )
      ).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
