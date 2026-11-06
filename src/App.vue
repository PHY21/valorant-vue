<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
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
import { useCatalog } from "./stores/catalog";
import { useAuth } from "./stores/auth.js";
const auth = useAuth();
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
            v-if="path === '/favorites' && store.favorites.length"
            class="nav-count"
            >{{ store.favorites.length }}</span
          ></RouterLink
        >
      </nav>
      <div class="sidebar-bottom">
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
      <main id="main" tabindex="-1">
        <RouterView
          v-if="
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
