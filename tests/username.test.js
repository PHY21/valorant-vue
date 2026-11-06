import test from "node:test";
import assert from "node:assert/strict";
import {
  usernameIdentity,
  createAccountService,
  validateRegistration,
} from "../src/lib/auth.js";

test("usernames normalize case and never accept real email addresses", () => {
  assert.equal(
    usernameIdentity(" Player_21 "),
    "atlas.player_21@accounts.invalid",
  );
  for (const value of [
    "a",
    "123abc",
    "someone@example.com",
    "abc.def",
    "用户甲",
    "a".repeat(25),
    "abc/def",
  ])
    assert.throws(() => usernameIdentity(value), /用户名/);
});
test("username registration sends a reserved internal identity and returns an actual session", async () => {
  let request;
  const service = createAccountService({
    auth: {
      signUp: async (args) => {
        request = args;
        return {
          data: { user: { id: "a" }, session: { user: { id: "a" } } },
          error: null,
        };
      },
    },
  });
  const fields = {
    username: " Player_21 ",
    name: "玩家",
    password: "Strong password",
    confirm: "Strong password",
  };
  assert.equal(validateRegistration(fields), "");
  const result = await service.register(fields);
  assert.equal(request.email, "atlas.player_21@accounts.invalid");
  assert.equal(request.options.data.username, "player_21");
  assert.equal(request.options.emailRedirectTo, undefined);
  assert.equal(result.session.user.id, "a");
});
test("a server still requiring email confirmation is treated as a configuration failure", async () => {
  const service = createAccountService({
    auth: { signUp: async () => ({ data: { session: null }, error: null }) },
  });
  await assert.rejects(
    service.register({
      username: "player",
      name: "玩家",
      password: "Strong password",
      confirm: "Strong password",
    }),
    /配置/,
  );
});
