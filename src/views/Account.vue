<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowUpRight, ShieldCheck, UserRound } from "lucide-vue-next";
import { useAuth } from "../stores/auth.js";
import { safeReturnPath } from "../lib/auth.js";
const auth = useAuth(),
  route = useRoute(),
  router = useRouter();
const registering = computed(() => route.path === "/register");
const destination = computed(() => safeReturnPath(route.query.returnTo));
const name = ref(""),
  email = ref(""),
  password = ref(""),
  confirm = ref("");
const busy = ref(false),
  error = ref(""),
  message = ref(""),
  pendingEmail = ref(""),
  showPassword = ref(false);
const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin)
  .href;
watch(
  () => route.path,
  () => {
    error.value = "";
    message.value = "";
    password.value = "";
    confirm.value = "";
    pendingEmail.value = "";
  },
);
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    if (registering.value) {
      const loggedIn = await auth.register(
        {
          name: name.value,
          email: email.value,
          password: password.value,
          confirm: confirm.value,
        },
        redirectTo,
      );
      if (!loggedIn) {
        pendingEmail.value = email.value.trim();
        message.value =
          "如果此邮箱可用于注册，验证邮件将发送到你的邮箱。请打开邮件完成验证；已有账号可直接登录。";
        password.value = "";
        confirm.value = "";
        return;
      }
    } else {
      await auth.login(email.value, password.value);
    }
    password.value = "";
    confirm.value = "";
    await router.replace(destination.value);
  } catch (failure) {
    error.value = failure.message;
  } finally {
    busy.value = false;
  }
}
async function resend() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await auth.resend(pendingEmail.value || email.value, redirectTo);
    auth.error = "";
    message.value = "验证邮件已请求发送，请查看收件箱或垃圾邮件。";
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
    message.value = "已退出此浏览器的账号。";
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
        加入 Atlas，用你的视角记录赛场表现。<br />同一个账号，在不同设备继续交流。
      </p>
      <div class="account-benefit">
        <ShieldCheck :size="20" /><span>邮箱验证 · 账号专属评价</span>
      </div>
      <div class="account-art" aria-hidden="true">
        V<span>ATLAS / COMMUNITY</span>
      </div>
    </section>
    <section class="panel account-card" aria-labelledby="account-title">
      <div class="account-icon"><UserRound :size="25" /></div>
      <template v-if="!auth.ready"
        ><h2 id="account-title">正在恢复账号</h2>
        <p role="status">请稍候…</p></template
      >
      <template v-else-if="auth.user">
        <span class="eyebrow">MY ACCOUNT</span>
        <h2 id="account-title">你好，{{ auth.displayName }}</h2>
        <p class="account-email">{{ auth.user.email }}</p>
        <p class="method-note">
          你已登录。公开评价将使用你的账号昵称，换设备登录后仍可管理自己的评价。选手收藏仍仅保存在当前浏览器。
        </p>
        <RouterLink
          class="btn"
          :to="destination === '/account' ? '/explore/player' : destination"
          >继续探索 <ArrowUpRight :size="16"
        /></RouterLink>
        <button class="btn secondary" :disabled="busy" @click="logout">
          {{ busy ? "正在退出…" : "退出登录" }}
        </button>
      </template>
      <template v-else>
        <span class="eyebrow">{{
          registering ? "CREATE AN ACCOUNT" : "WELCOME BACK"
        }}</span>
        <h2 id="account-title">
          {{ registering ? "注册你的账号" : "欢迎回到 Atlas" }}
        </h2>
        <p class="muted">
          {{
            registering
              ? "用常用邮箱开启你的图鉴之旅。"
              : "登录账号，继续分享你的看法。"
          }}
        </p>
        <p v-if="!auth.configured" class="notice" role="status">
          账号服务正在准备中，暂时无法注册或登录。你仍可浏览全部图鉴。
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
                placeholder="1–24 个字符，公开评价时展示"
            /></label>
            <label
              >邮箱<input
                v-model="email"
                name="email"
                type="email"
                autocomplete="email"
                maxlength="254"
                required
                placeholder="you@example.com"
            /></label>
            <label
              >密码<input
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="
                  registering ? 'new-password' : 'current-password'
                "
                :minlength="registering ? 8 : undefined"
                maxlength="128"
                required
                :placeholder="registering ? '至少 8 个字符' : '输入你的密码'"
            /></label>
            <label v-if="registering"
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
            <button type="submit" class="btn account-submit">
              {{ busy ? "正在处理…" : registering ? "创建账号" : "登录"
              }}<ArrowUpRight :size="17" />
            </button>
          </fieldset>
        </form>
        <p v-if="registering" class="caption">
          注册后请查看验证邮件。昵称和发表的评价公开可见，邮箱不会展示在评价中。
        </p>
        <button
          v-if="pendingEmail || (error || auth.error).includes('验证')"
          class="text-link resend-button"
          :disabled="busy || !auth.configured"
          @click="resend"
        >
          重新发送验证邮件
        </button>
        <p class="account-switch">
          {{ registering ? "已经有账号？" : "还没有账号？" }}
          <RouterLink
            :to="{
              path: registering ? '/login' : '/register',
              query: { returnTo: destination },
            }"
            >{{ registering ? "去登录" : "立即注册" }} ↗</RouterLink
          >
        </p>
      </template>
      <p v-if="error || auth.error" role="alert" class="form-error">
        {{ error || auth.error }}
      </p>
      <p v-if="message" role="status" class="notice">{{ message }}</p>
    </section>
  </div>
</template>
