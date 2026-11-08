<script setup>
import { computed } from "vue";
import { Heart } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
import PageHeading from "../components/PageHeading.vue";
import PlayerCard from "../components/PlayerCard.vue";
import TeamCard from "../components/TeamCard.vue";
const s = useCatalog();
const list = computed(() =>
  s.players.filter((p) => s.favorites.includes(p.player_id)),
);
const teams = computed(() =>
  s.data.team.filter((t) => s.teamFavorites.includes(t.team_id)),
);
</script>
<template>
  <PageHeading
    eyebrow="YOUR COLLECTION"
    title="我的收藏"
    description="你关注的选手和战队保存在当前浏览器。"
  />
  <section class="section">
    <div class="section-heading">
      <h2>
        战队 <span class="muted">{{ teams.length }}</span>
      </h2>
      <RouterLink to="/explore/team" class="text-link">发现战队 ↗</RouterLink>
    </div>
    <div v-if="teams.length" class="directory-grid">
      <TeamCard v-for="t in teams" :key="t.team_id" :team="t" />
    </div>
    <p v-else class="notice">还没有收藏的战队。在战队卡片上点爱心即可收藏。</p>
  </section>
  <section class="section">
    <div class="section-heading">
      <h2>
        选手 <span class="muted">{{ list.length }}</span>
      </h2>
      <RouterLink to="/explore/player" class="text-link"
        >发现选手 ↗</RouterLink
      >
    </div>
    <div v-if="list.length" class="player-grid">
      <PlayerCard v-for="p in list" :player="p" :key="p.player_id" />
    </div>
    <div v-else class="empty">
      <Heart :size="40" />
      <h2>还没有收藏的选手</h2>
      <p>在选手卡片上点一下爱心，把关注的名字留在这里。</p>
      <RouterLink to="/explore/player" class="btn">去发现选手 ↗</RouterLink>
    </div>
  </section>
</template>
