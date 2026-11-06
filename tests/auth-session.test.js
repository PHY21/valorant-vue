import test from "node:test";
import assert from "node:assert/strict";
import { createPinia } from "pinia";
import { createAuthStore } from "../src/stores/auth.js";

test("expired confirmation reports initialization error even when getSession returns no error", async () => {
  const store = createAuthStore({
    auth: {
      onAuthStateChange() {},
      initialize: async () => ({ error: { code: "otp_expired" } }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  })(createPinia());
  await store.initialize();
  assert.equal(store.ready, true);
  assert.equal(store.user, null);
  assert.match(store.error, /验证链接已过期/);
});

test("restores session, listens for other-tab signout and does not register duplicate listeners", async () => {
  let listener,
    subscriptions = 0;
  const store = createAuthStore({
    auth: {
      onAuthStateChange(fn) {
        listener = fn;
        subscriptions++;
      },
      initialize: async () => ({ error: null }),
      getSession: async () => ({
        data: {
          session: {
            user: { id: "alice", user_metadata: { display_name: "Alice" } },
          },
        },
        error: null,
      }),
    },
  })(createPinia());
  await store.initialize();
  await store.initialize();
  assert.equal(store.user.id, "alice");
  assert.equal(store.displayName, "Alice");
  assert.equal(subscriptions, 1);
  listener("SIGNED_OUT", null);
  assert.equal(store.user, null);
});

test("logout failure keeps local user until SDK confirms signout", async () => {
  const store = createAuthStore({
    auth: {
      onAuthStateChange() {},
      initialize: async () => ({ error: null }),
      getSession: async () => ({
        data: { session: { user: { id: "alice" } } },
        error: null,
      }),
      signOut: async () => ({ error: { code: "request_timeout" } }),
    },
  })(createPinia());
  await store.initialize();
  await assert.rejects(store.logout(), /连接/);
  assert.equal(store.user.id, "alice");
});
