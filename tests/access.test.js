import test from "node:test";
import assert from "node:assert/strict";
import { accessDestination } from "../src/lib/access.js";
test("anonymous deep links redirect to login with safe return destination", () => {
  for (const path of [
    "/",
    "/favorites",
    "/detail/player/1",
    "/about",
    "/explore/team",
  ]) {
    assert.deepEqual(accessDestination({ path, fullPath: path }, null), {
      path: "/login",
      query: { returnTo: path },
    });
  }
  for (const path of [
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
  ])
    assert.equal(accessDestination({ path }, null), true);
});
test("recovery session stays on reset page and legacy identity cannot enter", () => {
  const user = { email: "a@qq.com", email_confirmed_at: "today" };
  assert.equal(accessDestination({ path: "/", fullPath: "/" }, user), true);
  assert.equal(accessDestination({ path: "/" }, user, true), "/reset-password");
  assert.equal(
    accessDestination({ path: "/reset-password" }, user, true),
    true,
  );
  assert.equal(
    accessDestination(
      { path: "/", fullPath: "/" },
      { email: "atlas.player@accounts.invalid", email_confirmed_at: "today" },
    ).path,
    "/login",
  );
});
