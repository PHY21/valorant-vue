import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./style.css";
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
    {
      path: "/:pathMatch(.*)*",
      component: () => import("./views/NotFound.vue"),
    },
  ],
});
router.afterEach(() => {
  document.title = "VALORANT Atlas · 电竞数据图鉴";
});
createApp(App).use(createPinia()).use(router).mount("#app");
