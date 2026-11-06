import test from "node:test";
import assert from "node:assert/strict";
import {
  safeReturnPath,
  validateRegistration,
  publicAuthConfig,
  authMessage,
  createAccountService,
} from "../src/lib/auth.js";

test("only known local app routes can be return destinations", () => {
  for (const input of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/login",
    "/register",
    "/%2f%2fevil.test",
    ["/favorites"],
    null,
    "/detail/player/nope",
  ]) {
    assert.equal(safeReturnPath(input), "/account");
  }
  assert.equal(safeReturnPath("/detail/player/12"), "/detail/player/12");
  assert.equal(
    safeReturnPath("/explore/player?q=abc"),
    "/explore/player?q=abc",
  );
});
test("registration validates matching password, nickname and email without trimming password", () => {
  const good = {
    email: "player@example.com",
    password: "a strong password",
    confirm: "a strong password",
    name: "小明",
  };
  assert.equal(validateRegistration(good), "");
  assert.match(validateRegistration({ ...good, confirm: "wrong" }), /一致/);
  assert.match(validateRegistration({ ...good, name: "  " }), /昵称/);
  assert.match(validateRegistration({ ...good, email: "not-email" }), /邮箱/);
  assert.match(
    validateRegistration({ ...good, password: "123", confirm: "123" }),
    /8/,
  );
});
test("only HTTPS Supabase host and public publishable key may enter frontend config", () => {
  assert.ok(
    publicAuthConfig("https://abc.supabase.co", "sb_publishable_example"),
  );
  for (const [url, key] of [
    ["http://abc.supabase.co", "sb_publishable_example"],
    ["https://evil.test", "sb_publishable_example"],
    ["https://abc.supabase.co", "sb_secret_example"],
    ["", ""],
  ]) {
    assert.equal(publicAuthConfig(url, key), null);
  }
});
test("service reports confirmation pending and keeps password only in SDK request", async () => {
  let request;
  const service = createAccountService({
    auth: {
      signUp: async (args) => {
        request = args;
        return { data: { user: { id: "u" }, session: null }, error: null };
      },
    },
  });
  const result = await service.register(
    {
      email: " player@example.com ",
      name: " 玩家 ",
      password: "password 123",
      confirm: "password 123",
    },
    "https://site.test/",
  );
  assert.equal(result.session, null);
  assert.equal(request.email, "player@example.com");
  assert.equal(request.options.data.display_name, "玩家");
  assert.equal(request.password, "password 123");
  assert.equal("password" in result, false);
});
test("service rejects invalid registration before sending any network request", async () => {
  let called = false;
  const service = createAccountService({
    auth: {
      signUp: () => {
        called = true;
      },
    },
  });
  await assert.rejects(service.register({}), /邮箱/);
  assert.equal(called, false);
});
test("login, logout errors propagate and unconfigured service never fakes success", async () => {
  const service = createAccountService({
    auth: {
      signInWithPassword: async () => ({
        error: { code: "invalid_credentials" },
      }),
      signOut: async () => ({ error: { code: "request_timeout" } }),
    },
  });
  await assert.rejects(service.login("p@example.com", "bad"), /邮箱或密码/);
  await assert.rejects(service.logout(), /连接/);
  await assert.rejects(
    createAccountService(null).login("a@b.co", "123"),
    /尚未/,
  );
  assert.match(authMessage({ code: "email_not_confirmed" }), /验证/);
  assert.match(authMessage({ code: "over_email_send_rate_limit" }), /稍后/);
});

test("resend requires an email and cannot send an empty callback recovery request", async () => {
  let sent = false;
  const service = createAccountService({
    auth: {
      resend: async () => {
        sent = true;
        return { data: {}, error: null };
      },
    },
  });
  await assert.rejects(service.resend("", "https://site.test/"), /邮箱/);
  assert.equal(sent, false);
});
