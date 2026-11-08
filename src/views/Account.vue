<script setup>
import { computed, ref, watch, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowUpRight, ShieldCheck, Mail } from "lucide-vue-next";
import { useAuth } from "../stores/auth.js";
import { safeReturnPath } from "../lib/auth.js";
const auth = useAuth(),
  route = useRoute(),
  router = useRouter();
const mode = computed(() => route.path);
const registering = computed(() => mode.value === "/register");
const verifying = computed(() => mode.value === "/verify-email");
const forgot = computed(() => mode.value === "/forgot-password");
const resetting = computed(() => mode.value === "/reset-password");
const destination = computed(() => safeReturnPath(route.query.returnTo));
const name = ref(""),
  email = ref(""),
  password = ref(""),
  confirm = ref(""),
  token = ref("");
try {
  email.value = sessionStorage.getItem("atlas-auth-email") || "";
} catch {}
const busy = ref(false),
  error = ref(""),
  message = ref(""),
  showPassword = ref(false);
const remaining = ref(0);
let timer;
function cooldown() {
  remaining.value = 60;
  clearInterval(timer);
  timer = setInterval(() => {
    if (--remaining.value <= 0) clearInterval(timer);
  }, 1000);
}
onUnmounted(() => clearInterval(timer));
function saveEmail() {
  try {
    sessionStorage.setItem("atlas-auth-email", email.value.trim());
  } catch {}
}
const title = computed(() =>
  auth.member
    ? `你好，${auth.displayName}`
    : {
        "/register": "创建邮箱账号",
        "/verify-email": "验证你的邮箱",
        "/forgot-password": "找回密码",
        "/reset-password": auth.passwordUpdated
          ? "完成安全退出"
          : auth.recovering
            ? "设置新密码"
            : "输入找回验证码",
      }[mode.value] || "欢迎回到 Atlas",
);
const caption = computed(
  () =>
    ({
      "/register": "使用可以收信的邮箱，验证后即可进入图鉴。",
      "/verify-email": "输入注册邮件中的数字验证码，确认邮箱属于你。",
      "/forgot-password": "输入注册邮箱，我们会向符合条件的账号发送验证码。",
      "/reset-password": auth.passwordUpdated
        ? "密码已更新。请重试安全退出，完成后使用新密码登录。"
        : auth.recovering
          ? "为账号设置一个新的密码。"
          : "如果邮箱已注册，请查收邮件并输入其中的验证码。",
    })[mode.value] || "请使用已验证的邮箱和密码登录。",
);
const submitLabel = computed(() =>
  registering.value
    ? "注册并发送验证码"
    : verifying.value
      ? "验证邮箱"
      : forgot.value
        ? "发送找回验证码"
        : resetting.value
          ? auth.recovering
            ? auth.passwordUpdated
              ? "重试安全退出"
              : "保存新密码"
            : "验证身份"
          : "登录",
);
watch(mode, () => {
  error.value = "";
  message.value = "";
  password.value = "";
  confirm.value = "";
  token.value = "";
  showPassword.value = false;
});
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  auth.error = "";
  saveEmail();
  try {
    if (registering.value) {
      await auth.register({
        email: email.value,
        name: name.value,
        password: password.value,
        confirm: confirm.value,
      });
      password.value = "";
      confirm.value = "";
      await router.replace({
        path: "/verify-email",
        query: { returnTo: destination.value },
      });
      message.value = "如果邮箱可用于注册，验证码已发送，请同时检查垃圾邮件。";
      cooldown();
    } else if (verifying.value) {
      await auth.verifyEmail(email.value, token.value, "email");
      await router.replace(destination.value);
    } else if (forgot.value) {
      await auth.requestReset(email.value);
      await router.push("/reset-password");
      cooldown();
    } else if (resetting.value) {
      if (auth.recovering) {
        await auth.resetPassword(password.value, confirm.value);
        password.value = "";
        confirm.value = "";
        await router.replace("/login");
        message.value = "密码已更新，请使用新密码登录。";
      } else {
        await auth.verifyEmail(email.value, token.value, "recovery");
        token.value = "";
      }
    } else {
      await auth.login(email.value, password.value);
      password.value = "";
      await router.replace(destination.value);
    }
  } catch (failure) {
    error.value = failure.message;
  } finally {
    busy.value = false;
  }
}
async function resend() {
  if (busy.value || remaining.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    verifying.value
      ? await auth.resendVerification(email.value)
      : await auth.requestReset(email.value);
    message.value = "如果账号符合条件，验证码已发送，请检查收件箱和垃圾邮件。";
    cooldown();
  } catch (failure) {
    error.value = failure.message;
  } finally {
    busy.value = false;
  }
}
async function logout() {
  busy.value = true;
  error.value = "";
  try {
    await auth.logout();
    await router.replace("/login");
  } catch (failure) {
    error.value = failure.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="account-layout">
    <section class="account-intro">
      <span class="eyebrow">YOUR PLACE IN THE GAME</span>
      <h1>每一份热爱，<br />都有自己的主场<span>。</span></h1>
      <p>
        登录 Atlas，探索选手、战队与赛事。<br />验证邮箱后，在不同设备继续你的图鉴之旅。
      </p>
      <div class="account-benefit">
        <ShieldCheck :size="20" /><span>邮箱验证 · 安全登录 · 密码找回</span>
      </div>
      <div class="account-art" aria-hidden="true">
        V<span>ATLAS / COMMUNITY</span>
      </div>
    </section>
    <section class="panel account-card" aria-labelledby="account-title">
      <div class="account-icon"><Mail :size="25" /></div>
      <template v-if="!auth.ready"
        ><h2 id="account-title">正在恢复账号</h2>
        <p role="status">请稍候…</p></template
      >
      <template v-else-if="auth.member">
        <span class="eyebrow">MY ACCOUNT</span>
        <h2 id="account-title">{{ title }}</h2>
        <p class="account-email">{{ auth.user.email }}</p>
        <p class="method-note">
          邮箱已验证。你可以在不同设备登录并管理自己的评价。收藏和站内消息随账号同步。
        </p>
        <RouterLink
          class="btn"
          :to="destination === '/account' ? '/' : destination"
          >进入图鉴 <ArrowUpRight :size="16"
        /></RouterLink>
        <button class="btn secondary" :disabled="busy" @click="logout">
          退出登录
        </button>
      </template>
      <template v-else>
        <span class="eyebrow">ATLAS ACCOUNT</span>
        <h2 id="account-title">{{ title }}</h2>
        <p class="muted">{{ caption }}</p>
        <p v-if="!auth.configured" class="notice" role="status">
          账号服务正在准备中，请稍后再试。
        </p>
        <p v-if="auth.user && !auth.recovering" class="notice">
          当前账号未绑定已验证的真实邮箱。请退出旧账号后，用邮箱重新注册。<button
            class="text-btn"
            @click="logout"
          >
            退出旧账号
          </button>
        </p>
        <form @submit.prevent="submit" :aria-busy="busy">
          <fieldset :disabled="busy || !auth.configured || !auth.ready">
            <label v-if="registering"
              >昵称<input
                v-model="name"
                name="nickname"
                autocomplete="nickname"
                maxlength="24"
                required
                placeholder="1–24 个字符，评价时展示"
            /></label>
            <label v-if="!auth.recovering"
              >邮箱<input
                v-model="email"
                name="email"
                type="email"
                autocomplete="email"
                autocapitalize="none"
                spellcheck="false"
                maxlength="254"
                required
                placeholder="输入你可以收信的邮箱"
            /></label>
            <template v-if="verifying || (resetting && !auth.recovering)">
              <label
                >邮箱验证码<input
                  v-model="token"
                  name="otp"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  pattern="[0-9]{6,10}"
                  minlength="6"
                  maxlength="10"
                  required
                  placeholder="输入邮件中的数字验证码"
              /></label>
            </template>
            <template
              v-if="
                registering ||
                (!verifying && !forgot && !resetting) ||
                (auth.recovering && !auth.passwordUpdated)
              "
            >
              <label
                >{{ auth.recovering ? "新密码" : "密码"
                }}<input
                  v-model="password"
                  name="password"
                  :type="showPassword ? 'text' : 'password'"
                  :autocomplete="
                    registering || auth.recovering
                      ? 'new-password'
                      : 'current-password'
                  "
                  :minlength="registering || auth.recovering ? 8 : undefined"
                  maxlength="128"
                  required
                  placeholder="至少 8 个字符"
              /></label>
              <label
                v-if="registering || (auth.recovering && !auth.passwordUpdated)"
                >确认密码<input
                  v-model="confirm"
                  name="confirm-password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  minlength="8"
                  maxlength="128"
                  required
                  placeholder="再次输入密码"
              /></label>
              <label class="password-toggle"
                ><input type="checkbox" v-model="showPassword" />显示密码</label
              >
            </template>
            <button
              type="submit"
              class="btn account-submit"
              :disabled="(forgot || registering) && remaining > 0"
            >
              {{ busy ? "正在处理…" : submitLabel }} <ArrowUpRight :size="17" />
            </button>
          </fieldset>
        </form>
        <button
          v-if="verifying || (resetting && !auth.recovering)"
          class="btn secondary"
          :disabled="busy || remaining > 0"
          @click="resend"
        >
          {{ remaining > 0 ? `${remaining} 秒后可重新发送` : "重新发送验证码" }}
        </button>
        <p v-if="registering" class="caption">
          邮箱用于登录、验证和找回密码，不会展示在评价中。昵称和评价对已登录用户可见。旧用户名账号需使用真实邮箱重新注册。
        </p>
        <p v-if="mode === '/login'" class="account-switch">
          <RouterLink to="/forgot-password">忘记密码？</RouterLink> ·
          <RouterLink to="/verify-email">验证邮箱</RouterLink>
        </p>
        <p v-if="!auth.recovering" class="account-switch">
          <RouterLink
            :to="{
              path: mode === '/login' ? '/register' : '/login',
              query: { returnTo: destination },
            }"
            >{{
              mode === "/login" ? "还没有账号？立即注册" : "返回登录"
            }}
            ↗</RouterLink
          >
        </p>
        <button
          v-if="auth.recovering"
          class="text-btn"
          :disabled="busy"
          @click="logout"
        >
          {{ auth.passwordUpdated ? "重试安全退出" : "取消并退出" }}
        </button>
      </template>
      <p v-if="error || auth.error" role="alert" class="form-error">
        {{ error || auth.error }}
      </p>
      <p v-if="message" role="status" class="notice">{{ message }}</p>
    </section>
  </div>
</template>
