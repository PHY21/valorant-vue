import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./style.css";
import { useAuth } from "./stores/auth.js";
import { watch } from "vue";
import { accessDestination } from "./lib/access.js";
const pinia = createPinia();
const auth = useAuth(pinia);
auth.initialize();
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
    { path: "/compare/teams", component: () => import("./views/TeamCompare.vue") },
    { path: "/favorites", component: () => import("./views/Favorites.vue") },
    { path: "/about", component: () => import("./views/About.vue") },
    { path: "/login", component: () => import("./views/Account.vue") },
    { path: "/register", component: () => import("./views/Account.vue") },
    { path: "/verify-email", component: () => import("./views/Account.vue") },
    {
      path: "/forgot-password",
      component: () => import("./views/Account.vue"),
    },
    { path: "/reset-password", component: () => import("./views/Account.vue") },
    { path: "/account", component: () => import("./views/Account.vue") },
    { path: "/admin", component: () => import("./views/Admin.vue") },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("./views/NotFound.vue"),
    },
  ],
});
router.beforeEach(async (to) => {
  await auth.initialize();
  return accessDestination(to, auth.user, auth.recovering);
});
watch([() => auth.member, () => auth.recovering], () => {
  const destination = accessDestination(
    router.currentRoute.value,
    auth.user,
    auth.recovering,
  );
  if (destination !== true) router.replace(destination);
});
router.afterEach(() => {
  document.title = "VALORANT Atlas · 电竞数据图鉴";
});
createApp(App).use(pinia).use(router).mount("#app");
