import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("database identity guard rejects real addresses, spoofed metadata and username changes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin;
      create schema auth; create table auth.users(id uuid primary key, email text unique, raw_user_meta_data jsonb);
      grant usage on schema auth,public to supabase_auth_admin;
      grant all on auth.users to supabase_auth_admin;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202611060002_username_accounts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("set role supabase_auth_admin");
    await assert.rejects(
      db.query(
        `insert into auth.users values(gen_random_uuid(), 'real@example.com', '{"username":"real"}')`,
      ),
      /Invalid Atlas/,
    );
    await assert.rejects(
      db.query(
        `insert into auth.users values(gen_random_uuid(), 'atlas.real@accounts.invalid', '{}')`,
      ),
      /Invalid Atlas/,
    );
    await assert.rejects(
      db.query(
        `insert into auth.users values(gen_random_uuid(), 'atlas.real@accounts.invalid', '{"username":"someoneelse"}')`,
      ),
      /Invalid Atlas/,
    );
    await db.exec(
      `insert into auth.users values(gen_random_uuid(), 'atlas.player21@accounts.invalid', '{"username":"player21"}')`,
    );
    await assert.rejects(
      db.query(`update auth.users set email='other@example.com'`),
      /Invalid Atlas/,
    );
    await assert.rejects(
      db.query(
        `update auth.users set email='atlas.player22@accounts.invalid', raw_user_meta_data='{"username":"player22"}'`,
      ),
      /cannot be changed/,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from auth.users")).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
