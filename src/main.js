import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./style.css";
import { useAuth } from "./stores/auth.js";
const pinia = createPinia();
const auth = useAuth(pinia);
// Supabase consumes its URL fragment before the hash router can rewrite it.
const authCallback = /^#(?:access_token=|error=|error_code=)/.test(
  window.location.hash,
);
const restored = auth.initialize();
if (authCallback) {
  await restored;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#/account`,
  );
}
const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", component: () => import("./views/Dashboard.vue") },
    { path: "/explore/:kind", component: () => import("./views/Explore.vue") },
    {
      path: "/detail/:kind/:id",
      component: () => import("./views/Detail.vue"),
    },
    { path: "/rankings", component: () => import("./views/Rankings.vue") },
    { path: "/compare", component: () => import("./views/Compare.vue") },
    { path: "/favorites", component: () => import("./views/Favorites.vue") },
    { path: "/about", component: () => import("./views/About.vue") },
    { path: "/login", component: () => import("./views/Account.vue") },
    { path: "/register", component: () => import("./views/Account.vue") },
    { path: "/account", component: () => import("./views/Account.vue") },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("./views/NotFound.vue"),
    },
  ],
});
router.afterEach(() => {
  document.title = "VALORANT Atlas · 电竞数据图鉴";
});
createApp(App).use(pinia).use(router).mount("#app");
