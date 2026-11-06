<script setup>
import PageHeading from "../components/PageHeading.vue";
</script>
<template>
  <PageHeading
    eyebrow="ABOUT THE PROJECT"
    title="从课程作业，到交互作品"
    description="VALORANT Atlas 是基于原 PHP 数据库课程项目独立升级的 Vue 3 前端作品。"
  />
  <div class="about-grid">
    <section class="panel">
      <span class="eyebrow">01 / FRONTEND</span>
      <h2>可探索，也可讲清楚</h2>
      <p>
        Vue 3 Composition API 组织页面逻辑，Vue Router 管理详情与筛选路由，Pinia
        管理数据、登录状态和本地收藏。Vite 构建静态站点，页面按路由加载。
      </p>
      <div class="tech-tags">
        <span
          v-for="x in [
            'Vue 3',
            'JavaScript',
            'Vue Router',
            'Pinia',
            'Vite',
            'CSS Grid',
          ]"
          >{{ x }}</span
        >
      </div>
    </section>
    <section class="panel">
      <span class="eyebrow">02 / DATA</span>
      <h2>沿用数据，尊重边界</h2>
      <p>
        数据从原项目的提交版 SQL
        导出，仅包含选手、战队、赛事、特工及其关联成绩。没有导出用户账号、密码哈希或私人评论。课程数据并非实时战绩或官方排名。
      </p>
    </section>
    <section class="panel">
      <span class="eyebrow">03 / INTERACTION</span>
      <h2>在线账号，公开交流</h2>
      <p>
        搜索、筛选、对比和排行榜基于收录数据计算。账号与公开评价使用 Supabase
        服务，配置完成后可跨设备登录；账号入口会显示服务是否可用。
        收藏和升级前的旧评价仍仅保存在当前浏览器，清除浏览器数据会移除这些本地记录。原
        PHP 账号不迁移，请另行注册。
      </p>
    </section>
    <section class="panel">
      <span class="eyebrow">04 / ORIGINAL</span>
      <h2>保留原来的起点</h2>
      <p>
        PHP + MySQL
        课程版本保持独立，包含原有注册、登录和数据库评论功能。本作品没有覆盖原网站。
      </p>
      <a
        class="text-link"
        href="https://github.com/PHY21/valorant-web"
        target="_blank"
        rel="noopener noreferrer"
        >查看原 PHP 项目 ↗</a
      >
    </section>
  </div>
  <section class="panel rights">
    <h2>素材说明</h2>
    <p>
      本项目是非官方学习与作品展示，VALORANT
      品牌与选手照片等素材归各自权利人所有。数据样本仅用于展示前端交互。
    </p>
  </section>
</template>
