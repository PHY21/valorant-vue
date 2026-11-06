<script setup>
import { computed } from "vue";
import { Heart } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
import PageHeading from "../components/PageHeading.vue";
import PlayerCard from "../components/PlayerCard.vue";
const s = useCatalog();
const list = computed(() =>
  s.players.filter((p) => s.favorites.includes(p.player_id)),
);
</script>
<template>
  <PageHeading
    eyebrow="YOUR COLLECTION"
    title="把喜欢，留在这里"
    description="你的选手收藏夹。内容仅保存在当前浏览器，刷新后仍可查看。"
  />
  <p class="result-line">已收藏 {{ list.length }} 位选手</p>
  <div v-if="list.length" class="player-grid">
    <PlayerCard v-for="p in list" :player="p" :key="p.player_id" />
  </div>
  <div v-else class="empty">
    <Heart :size="40" />
    <h2>还没有收藏的选手</h2>
    <p>在选手卡片上点一下爱心，把关注的名字留在这里。</p>
    <RouterLink to="/explore/player" class="btn">去发现选手 ↗</RouterLink>
  </div>
</template>
