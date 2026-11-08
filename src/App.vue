<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  Bell,
  LayoutDashboard,
  Users,
  Shield,
  Trophy,
  Crosshair,
  ChartNoAxesColumn,
  GitCompareArrows,
  Heart,
  ArrowUpRight,
  Menu,
  X,
  Info,
  UserRound,
} from "lucide-vue-next";
import { useMemberNews } from "./stores/memberNews";
import { useCatalog } from "./stores/catalog";
import { useAuth } from "./stores/auth.js";
import { supabase } from "./lib/supabase.js";
const auth = useAuth();
const news = useMemberNews();
watch(
  () => auth.member ? auth.user?.id : null,
  id => news.connect(id),
  { immediate: true, flush: "sync" },
);
const adminAccess = ref("checking");
const permissionRetry = ref(0);
watch([() => auth.member ? auth.user?.id : null, permissionRetry], async ([id], _, onCleanup) => {
  let current = true;
  onCleanup(() => { current = false; });
  adminAccess.value = id ? "checking" : "denied";
  if (!id) return;
  try {
    const { data, error } = await supabase.rpc("atlas_is_admin");
    if (current) adminAccess.value = error ? "error" : data === true ? "allowed" : "denied";
  } catch { if (current) adminAccess.value = "error"; }
}, { immediate: true, flush: "sync" });
function focusMain() {
  const el = document.getElementById("main");
  el?.focus();
  el?.scrollIntoView({ block: "start" });
}
const store = useCatalog(),
  route = useRoute(),
  menu = ref(false);
const nav = [
  ["/", "总览", LayoutDashboard],
  ["/explore/player", "选手图鉴", Users],
  ["/explore/team", "战队档案", Shield],
  ["/explore/tournament", "赛事中心", Trophy],
  ["/explore/agent", "特工图鉴", Crosshair],
  ["/rankings", "数据排行榜", ChartNoAxesColumn],
  ["/compare", "选手对比", GitCompareArrows],
  ["/compare/teams", "战队对比", GitCompareArrows],
  ["/favorites", "我的收藏", Heart],
];
watch(
  () => route.fullPath,
  () => (menu.value = false),
);
watch(
  () => auth.member,
  (member) => {
    if (member) store.load();
    else store.clearData();
  },
  { immediate: true },
);
</script>
<template>
  <div v-if="!auth.ready" class="loading-state">
    <div class="loader"></div>
    <p>正在恢复登录状态…</p>
  </div>
  <div v-else-if="!auth.member" class="auth-shell">
    <header class="auth-header">
      <span class="brand"
        ><span class="brand-icon">V</span> ATLAS / VALORANT</span
      ><span class="muted">登录后开启你的电竞图鉴</span>
    </header>
    <main><RouterView /></main>
    <footer class="footer">ATLAS © 2026 · 非官方 VALORANT 数据作品</footer>
  </div>
  <template v-else>
    <button class="skip-link" @click="focusMain">跳转到主要内容</button>
    <div class="mobile-bar">
      <RouterLink to="/" class="brand"
        ><span class="brand-icon">V</span> ATLAS<span class="brand-small"
          >/ VALORANT</span
        ></RouterLink
      ><button
        class="icon-btn"
        :aria-expanded="menu"
        aria-label="切换导航"
        @click="menu = !menu"
      >
        <X v-if="menu" /><Menu v-else />
      </button>
    </div>
    <button
      v-if="menu"
      class="nav-overlay"
      aria-label="关闭导航"
      @click="menu = false"
    ></button>
    <aside class="sidebar" :class="{ open: menu }">
      <RouterLink to="/" class="brand"
        ><span class="brand-icon">V</span>
        <div>ATLAS<small>VALORANT DATABASE</small></div></RouterLink
      >
      <div class="nav-caption">探索 / EXPLORE</div>
      <nav aria-label="主导航">
        <RouterLink
          v-for="[path, label, Icon] in nav"
          :key="path"
          :to="path"
          :class="{ active: route.path === path }"
          ><component :is="Icon" :size="18" /><span>{{ label }}</span
          ><span
            v-if="path === '/favorites' && store.favorites.length + store.teamFavorites.length"
            class="nav-count"
            >{{ store.favorites.length + store.teamFavorites.length }}</span
          ></RouterLink
        >
      </nav>
      <div class="sidebar-bottom">
        <RouterLink v-if="adminAccess === 'allowed'" to="/admin"><Shield :size="17" />网站管理</RouterLink>
        <RouterLink to="/about"
          ><Info :size="17" />关于这个项目<ArrowUpRight :size="16"
        /></RouterLink>
        <RouterLink
          :to="
            auth.user
              ? '/account'
              : { path: '/login', query: { returnTo: route.fullPath } }
          "
          ><UserRound :size="17" />{{
            auth.user ? "我的账号" : "登录 / 注册"
          }}</RouterLink
        >
        <div class="edition">
          <span class="status-dot"></span> COURSE DATA / DEMO<small
            >Built with Vue 3 · Designed to explore</small
          >
        </div>
      </div>
    </aside>
    <div class="workspace">
      <div class="topbar">
        <div>
          <span class="muted">探索游戏背后的</span> <strong>每一份实力</strong>
        </div>
        <div class="top-tools"><RouterLink to="/inbox" class="top-link inbox-link" :aria-label="'我的消息，'+news.unread+' 条未读'"><Bell :size="18"/><span>消息</span><b v-if="news.unread" class="unread-count">{{news.unread>99?'99+':news.unread}}</b></RouterLink>
        <RouterLink
          :to="
            auth.user
              ? '/account'
              : { path: '/login', query: { returnTo: route.fullPath } }
          "
          class="top-link account-nav"
          ><UserRound :size="16" /><span>{{
            auth.user ? auth.displayName : "登录 / 注册"
          }}</span></RouterLink
        >
        </div>
      </div>
      <main id="main" tabindex="-1">
        <div v-if="route.path === '/admin' && adminAccess !== 'allowed'" class="panel admin-panel notice" role="status">
          <p>{{ adminAccess === 'checking' ? '正在核对管理权限…' : adminAccess === 'error' ? '暂时无法核对管理权限。' : '此页面仅对网站管理员开放。' }}</p>
          <button v-if="adminAccess === 'error'" class="btn secondary" @click="permissionRetry++">重试</button>
          <RouterLink v-else-if="adminAccess === 'denied'" to="/">返回图鉴</RouterLink>
        </div>
        <RouterView v-else-if="route.path === '/admin' && store.data" :key="auth.user.id" />
        <RouterView
          v-else-if="
            [
              '/account',
              '/login',
              '/register',
              '/verify-email',
              '/forgot-password',
              '/reset-password',
            ].includes(route.path)
          "
        />
        <div v-else-if="store.loading" class="loading-state">
          <div class="loader"></div>
          <h2>正在打开电竞图鉴</h2>
          <p>加载选手、赛事与战队数据…</p>
        </div>
        <div v-else-if="store.error" class="empty">
          <h2>暂时无法连接图鉴</h2>
          <p>{{ store.error }}</p>
          <button class="btn" @click="store.load">重新加载</button>
        </div>
        <RouterView v-else-if="store.data" />
        <p v-if="news.followError" class="notice" role="alert">{{news.followError}} <button class="text-link" @click="news.refreshFollows()">重试同步</button></p>
        <p v-if="store.storageError" role="status" class="notice">
          {{ store.storageError }}
        </p>
      </main>
      <footer class="footer">
        <span>ATLAS © 2026 · 非官方 VALORANT 数据作品</span
        ><span
          >课程示例数据，非实时战绩 <span class="footer-slash">/</span>
          <RouterLink to="/about">数据与功能说明 ↗</RouterLink></span
        >
      </footer>
    </div>
  </template>
</template>

<style scoped>
.top-tools,.inbox-link{display:flex;align-items:center;gap:8px}.top-tools{gap:18px}
.unread-count{display:inline-grid;place-items:center;min-width:17px;height:17px;padding:0 4px;border-radius:12px;background:#b72d27;color:#fff;font-size:11px}
</style>
