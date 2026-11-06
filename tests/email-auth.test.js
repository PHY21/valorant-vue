import test from "node:test";
import assert from "node:assert/strict";
import * as auth from "../src/lib/auth.js";

test("email-only registration validates real addresses and matching passwords", () => {
  const good = {
    email: " Player@QQ.com ",
    name: "玩家",
    password: "Strong pass123",
    confirm: "Strong pass123",
  };
  assert.equal(auth.validateRegistration(good), "");
  for (const email of [
    "player",
    "atlas.player@accounts.invalid",
    "x@y.invalid",
    "x y@qq.com",
  ])
    assert.match(auth.validateRegistration({ ...good, email }), /邮箱/);
  assert.match(
    auth.validateRegistration({ ...good, confirm: "wrong" }),
    /一致/,
  );
});

test("registration without session means check inbox, never fake authentication", async () => {
  let request;
  const service = auth.createAccountService({
    auth: {
      signUp: async (args) => {
        request = args;
        return { data: { session: null, user: { id: "a" } } };
      },
    },
  });
  const data = await service.register({
    email: "Player@QQ.com",
    name: " 玩家 ",
    password: "Strong pass123",
    confirm: "Strong pass123",
  });
  assert.equal(request.email, "player@qq.com");
  assert.deepEqual(request.options.data, { display_name: "玩家" });
  assert.equal(data.session, null);
});

test("password recovery uses recovery OTP and never returns raw provider failures", async () => {
  const requests = [];
  const service = auth.createAccountService({
    auth: {
      resetPasswordForEmail: async (email) => {
        requests.push(["reset", email]);
        return { data: {} };
      },
      verifyOtp: async (args) => {
        requests.push(["verify", args]);
        return { data: { session: { user: { id: "a" } } } };
      },
      updateUser: async (args) => {
        requests.push(["update", args]);
        return { data: { user: { id: "a" } } };
      },
    },
  });
  await service.requestReset(" Player@QQ.com ");
  await service.verifyEmail("Player@QQ.com", "123456", "recovery");
  await service.updatePassword("New password123", "New password123");
  assert.deepEqual(requests, [
    ["reset", "player@qq.com"],
    ["verify", { email: "player@qq.com", token: "123456", type: "recovery" }],
    ["update", { password: "New password123" }],
  ]);
  await assert.rejects(
    service.verifyEmail("a@qq.com", "123", "recovery"),
    /验证码/,
  );
  await assert.rejects(service.updatePassword("short", "short"), /8/);
});

test("only verified real email accounts qualify for access", () => {
  assert.equal(typeof auth.hasVerifiedEmail, "function");
  for (const user of [
    null,
    { email: "a@qq.com" },
    { email: "atlas.a@accounts.invalid", email_confirmed_at: "today" },
    { email: "a@qq.com", email_confirmed_at: "today", is_anonymous: true },
  ])
    assert.equal(auth.hasVerifiedEmail(user), false);
  assert.equal(
    auth.hasVerifiedEmail({ email: "a@qq.com", email_confirmed_at: "today" }),
    true,
  );
});
