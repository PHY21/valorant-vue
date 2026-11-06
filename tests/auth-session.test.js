import test from "node:test";
import assert from "node:assert/strict";
import { createPinia } from "pinia";
import { createAuthStore } from "../src/stores/auth.js";

test("an existing second tab retries global signout after password changed elsewhere", async (t) => {
  const values = new Map();
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  t.after(() => {
    if (original) globalThis.localStorage = original;
    else delete globalThis.localStorage;
  });
  const user = { id: "alice", email: "a@qq.com", email_confirmed_at: "today" };
  const listeners = [],
    calls = [];
  const client = (name) => ({
    auth: {
      onAuthStateChange(fn) {
        listeners.push(fn);
      },
      initialize: async () => ({}),
      getSession: async () => ({ data: { session: { user } } }),
      getUser: async () => ({ data: { user } }),
      updateUser: async () => ({ data: { user } }),
      signOut: async (opts) => {
        calls.push([name, opts.scope]);
        return name === "a" ? { error: { code: "request_timeout" } } : {};
      },
    },
  });
  const a = createAuthStore(client("a"))(createPinia()),
    b = createAuthStore(client("b"))(createPinia());
  await a.initialize();
  await b.initialize();
  for (const listener of listeners) listener("PASSWORD_RECOVERY", { user });
  await assert.rejects(
    a.resetPassword("New password123", "New password123"),
    /密码已更新/,
  );
  await b.logout();
  assert.deepEqual(calls, [
    ["a", "global"],
    ["b", "global"],
  ]);
});

test("late initialization cannot undo a newer signout event", async () => {
  let listener, resolveUser, entered;
  const started = new Promise((resolve) => (entered = resolve));
  const pending = new Promise((resolve) => (resolveUser = resolve));
  const user = { id: "alice", email: "a@qq.com", email_confirmed_at: "today" };
  const store = createAuthStore({
    auth: {
      onAuthStateChange(fn) {
        listener = fn;
      },
      initialize: async () => ({}),
      getSession: async () => ({ data: { session: { user } } }),
      getUser() {
        entered();
        return pending;
      },
    },
  })(createPinia());
  const initialization = store.initialize();
  await started;
  listener("SIGNED_OUT", null);
  resolveUser({ data: { user } });
  await initialization;
  assert.equal(store.member, false);
  assert.equal(store.user, null);
});

test("password updated but global signout failed can retry only global signout", async () => {
  let listener,
    updates = 0,
    exits = 0;
  const user = { id: "alice", email: "a@qq.com", email_confirmed_at: "today" };
  const store = createAuthStore({
    auth: {
      onAuthStateChange(fn) {
        listener = fn;
      },
      initialize: async () => ({}),
      getSession: async () => ({ data: { session: null } }),
      updateUser: async () => {
        updates++;
        return { data: { user } };
      },
      signOut: async () => {
        exits++;
        return exits === 1 ? { error: { code: "request_timeout" } } : {};
      },
    },
  })(createPinia());
  await store.initialize();
  listener("PASSWORD_RECOVERY", { user });
  await assert.rejects(
    store.resetPassword("New password123", "New password123"),
    /密码已更新/,
  );
  assert.equal(store.passwordUpdated, true);
  assert.equal(store.member, false);
  await store.resetPassword("", "");
  assert.equal(updates, 1);
  assert.equal(exits, 2);
  assert.equal(store.user, null);
});

test("new tab retains recovery restriction for the persisted account", async (t) => {
  const values = new Map();
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  t.after(() => {
    if (original) globalThis.localStorage = original;
    else delete globalThis.localStorage;
  });
  const user = { id: "alice", email: "a@qq.com", email_confirmed_at: "today" };
  let listener;
  const client = {
    auth: {
      onAuthStateChange(fn) {
        listener = fn;
      },
      initialize: async () => ({}),
      getSession: async () => ({ data: { session: { user } } }),
      getUser: async () => ({ data: { user } }),
    },
  };
  const first = createAuthStore(client)(createPinia());
  await first.initialize();
  listener("PASSWORD_RECOVERY", { user });
  const second = createAuthStore(client)(createPinia());
  await second.initialize();
  assert.equal(second.recovering, true);
  assert.equal(second.member, false);
});

test("recovery event blocks membership, password update requires proof, then signs out globally", async () => {
  let listener;
  const calls = [];
  const user = {
    id: "alice",
    email: "alice@qq.com",
    email_confirmed_at: "today",
  };
  const store = createAuthStore({
    auth: {
      onAuthStateChange(fn) {
        listener = fn;
      },
      initialize: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null } }),
      updateUser: async (fields) => {
        calls.push(["update", fields]);
        return { data: { user } };
      },
      signOut: async (options) => {
        calls.push(["signout", options]);
        return {};
      },
    },
  })(createPinia());
  await store.initialize();
  await assert.rejects(
    store.resetPassword("New password123", "New password123"),
    /验证身份/,
  );
  listener("PASSWORD_RECOVERY", { user });
  assert.equal(store.recovering, true);
  assert.equal(store.member, false);
  await store.resetPassword("New password123", "New password123");
  assert.deepEqual(calls, [
    ["update", { password: "New password123" }],
    ["signout", { scope: "global" }],
  ]);
  assert.equal(store.user, null);
  assert.equal(store.recovering, false);
});

test("a cached session rejected by the auth server cannot enter the app", async () => {
  const store = createAuthStore({
    auth: {
      onAuthStateChange() {},
      initialize: async () => ({ error: null }),
      getSession: async () => ({
        data: {
          session: { user: { email: "a@qq.com", email_confirmed_at: "today" } },
        },
      }),
      getUser: async () => ({
        data: { user: null },
        error: { code: "session_not_found" },
      }),
    },
  })(createPinia());
  await store.initialize();
  assert.equal(store.ready, true);
  assert.equal(store.member, false);
  assert.equal(store.user, null);
});

test("session initialization failure is reported even when getSession returns no error", async () => {
  const store = createAuthStore({
    auth: {
      onAuthStateChange() {},
      initialize: async () => ({ error: { code: "request_timeout" } }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  })(createPinia());
  await store.initialize();
  assert.equal(store.ready, true);
  assert.equal(store.user, null);
  assert.match(store.error, /连接/);
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
      getUser: async () => ({
        data: {
          user: {
            id: "alice",
            email: "alice@qq.com",
            email_confirmed_at: "today",
            user_metadata: { display_name: "Alice" },
          },
        },
        error: null,
      }),
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
      getUser: async () => ({
        data: {
          user: {
            id: "alice",
            email: "alice@qq.com",
            email_confirmed_at: "today",
            user_metadata: { display_name: "Alice" },
          },
        },
        error: null,
      }),
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
