import { defineStore } from "pinia";
import { ref, computed, onScopeDispose } from "vue";
import { supabase } from "../lib/supabase.js";
import {
  createAccountService,
  authMessage,
  hasVerifiedEmail,
} from "../lib/auth.js";

export function createAuthStore(client) {
  return defineStore("auth", () => {
    const user = ref(null),
      ready = ref(false),
      error = ref("");
    const configured = Boolean(client);
    const recovering = ref(false);
    const passwordUpdated = ref(false);
    let recoveryUserId = null;
    function restoreRecovery() {
      try {
        const recovery = JSON.parse(
          localStorage.getItem("atlas-password-recovery"),
        );
        if (
          typeof recovery?.userId === "string" &&
          (!user.value || recovery.userId === user.value.id)
        ) {
          recoveryUserId = recovery.userId;
          recovering.value = true;
          passwordUpdated.value = recovery.passwordUpdated === true;
        } else {
          recoveryUserId = null;
          recovering.value = false;
          passwordUpdated.value = false;
        }
      } catch {}
    }
    restoreRecovery();
    if (typeof window !== "undefined") {
      const sync = (event) => {
        if (event.key === "atlas-password-recovery") restoreRecovery();
      };
      window.addEventListener("storage", sync);
      onScopeDispose(() => window.removeEventListener("storage", sync));
    }
    const member = computed(
      () => ready.value && hasVerifiedEmail(user.value) && !recovering.value,
    );
    function setRecovery(value, userId = user.value?.id) {
      if (!value || userId !== recoveryUserId) passwordUpdated.value = false;
      recovering.value = value;
      recoveryUserId = value ? userId : null;
      try {
        value
          ? localStorage.setItem(
              "atlas-password-recovery",
              JSON.stringify({
                userId,
                passwordUpdated: passwordUpdated.value,
              }),
            )
          : localStorage.removeItem("atlas-password-recovery");
      } catch {}
    }
    const service = createAccountService(client);
    const displayName = computed(
      () => user.value?.user_metadata?.display_name?.slice(0, 24) || "图鉴访客",
    );
    let initialization,
      revision = 0;
    function initialize() {
      if (initialization) return initialization;
      initialization = (async () => {
        if (!client) {
          ready.value = true;
          return;
        }
        // Keep this callback synchronous: awaiting SDK calls inside it can deadlock.
        client.auth.onAuthStateChange((_event, session) => {
          revision++;
          if (_event === "PASSWORD_RECOVERY")
            setRecovery(true, session?.user?.id);
          if (!session) setRecovery(false);
          else if (recoveryUserId && recoveryUserId !== session.user.id)
            setRecovery(false);
          user.value = session?.user || null;
        });
        let readingRevision;
        try {
          const { error: callbackError } = await client.auth.initialize();
          if (callbackError) error.value = authMessage(callbackError);
          readingRevision = revision;
          const { data, error: failure } = await client.auth.getSession();
          if (failure) throw failure;
          let checkedUser = null;
          if (data.session?.user) {
            const checked = await client.auth.getUser();
            if (checked.error) throw checked.error;
            checkedUser = checked.data.user;
          }
          if (revision === readingRevision) {
            user.value = checkedUser;
            if (
              !checkedUser ||
              (recoveryUserId && recoveryUserId !== checkedUser.id)
            )
              setRecovery(false);
          }
        } catch (failure) {
          if (readingRevision === undefined || revision === readingRevision) {
            user.value = null;
            error.value = authMessage(failure);
          }
        } finally {
          ready.value = true;
        }
      })();
      return initialization;
    }
    async function login(email, password) {
      const data = await service.login(email, password);
      if (!hasVerifiedEmail(data.user)) {
        await service.logout();
        throw new Error("请先验证真实邮箱，再登录网站。");
      }
      user.value = data.user;
      setRecovery(false);
      error.value = "";
    }
    async function register(fields) {
      const data = await service.register(fields);
      user.value = data.session?.user || null;
      error.value = "";
      return Boolean(data.session);
    }
    async function logout() {
      restoreRecovery();
      if (passwordUpdated.value) return resetPassword("", "");
      await service.logout();
      user.value = null;
      setRecovery(false);
    }
    async function verifyEmail(email, token, type) {
      const data = await service.verifyEmail(email, token, type);
      if (type === "recovery") setRecovery(true, data.session?.user?.id);
      user.value = data.session?.user || null;
      error.value = "";
    }
    async function resetPassword(password, confirm) {
      restoreRecovery();
      if (!recovering.value || !user.value)
        throw new Error("请先使用邮箱验证码验证身份。");
      if (!passwordUpdated.value) {
        await service.updatePassword(password, confirm);
        passwordUpdated.value = true;
        setRecovery(true);
      }
      // Sign out all refresh sessions after changing a forgotten password.
      const { error: failure } = await client.auth.signOut({ scope: "global" });
      if (failure)
        throw new Error("密码已更新，但退出会话失败，请重试退出登录。");
      user.value = null;
      setRecovery(false);
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
      member,
      recovering,
      passwordUpdated,
      verifyEmail,
      resetPassword,
      requestReset: service.requestReset,
      resendVerification: service.resendVerification,
    };
  });
}
export const useAuth = createAuthStore(supabase);
