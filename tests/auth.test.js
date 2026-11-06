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
    email: "player@qq.com",
    password: "a strong password",
    confirm: "a strong password",
    name: "小明",
  };
  assert.equal(validateRegistration(good), "");
  assert.match(validateRegistration({ ...good, confirm: "wrong" }), /一致/);
  assert.match(validateRegistration({ ...good, name: "  " }), /昵称/);
  assert.match(validateRegistration({ ...good, email: "bad-email" }), /邮箱/);
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
  await assert.rejects(service.login("player@qq.com", "bad"), /邮箱或密码/);
  await assert.rejects(service.logout(), /连接/);
  await assert.rejects(
    createAccountService(null).login("player@qq.com", "123"),
    /尚未/,
  );
  assert.match(authMessage({ code: "email_not_confirmed" }), /验证/);
  assert.match(authMessage({ code: "over_email_send_rate_limit" }), /稍后/);
});
