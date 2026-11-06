import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import { createAccountService, authMessage } from "../lib/auth.js";

export function createAuthStore(client) {
  return defineStore("auth", () => {
    const user = ref(null),
      ready = ref(false),
      error = ref("");
    const configured = Boolean(client);
    const service = createAccountService(client);
    const displayName = computed(
      () => user.value?.user_metadata?.display_name?.slice(0, 24) || "图鉴访客",
    );
    let initialization;
    function initialize() {
      if (initialization) return initialization;
      initialization = (async () => {
        if (!client) {
          ready.value = true;
          return;
        }
        // Keep this callback synchronous: awaiting SDK calls inside it can deadlock.
        client.auth.onAuthStateChange((_event, session) => {
          user.value = session?.user || null;
        });
        try {
          const { error: callbackError } = await client.auth.initialize();
          if (callbackError) error.value = authMessage(callbackError);
          const { data, error: failure } = await client.auth.getSession();
          if (failure) throw failure;
          user.value = data.session?.user || null;
        } catch (failure) {
          error.value = authMessage(failure);
        } finally {
          ready.value = true;
        }
      })();
      return initialization;
    }
    async function login(email, password) {
      const data = await service.login(email, password);
      user.value = data.user;
      error.value = "";
    }
    async function register(fields, redirectTo) {
      const data = await service.register(fields, redirectTo);
      user.value = data.session?.user || null;
      return Boolean(data.session);
    }
    async function logout() {
      await service.logout();
      user.value = null;
    }
    return {
      user,
      ready,
      configured,
      error,
      displayName,
      initialize,
      login,
      register,
      logout,
      resend: service.resend,
    };
  });
}
export const useAuth = createAuthStore(supabase);
