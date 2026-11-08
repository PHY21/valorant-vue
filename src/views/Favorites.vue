<script setup>
import { computed } from "vue";
import { Heart } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
import { useMemberNews } from "../stores/memberNews";
const news = useMemberNews();
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
    description="收藏后，选手转会和战队赛果会送到你的站内消息。"
  />
  <div v-if="s.legacyPlayers.length || s.legacyTeams.length" class="notice">
    <p>
      此浏览器有 {{ s.legacyPlayers.length }} 个选手和
      {{ s.legacyTeams.length }} 支战队的旧收藏。
    </p>
    <button
      class="btn secondary"
      :disabled="news.importing"
      @click="s.importFavorites()"
    >
      {{ news.importing ? "正在导入…" : "导入到我的账号" }}
    </button>
  </div>
  <p v-if="!news.followReady" role="status">
    {{ news.followError || "正在读取账号收藏…" }}
  </p>
  <template v-if="news.followReady"
    ><section class="section">
      <div class="section-heading">
        <h2>
          战队 <span class="muted">{{ teams.length }}</span>
        </h2>
        <RouterLink to="/explore/team" class="text-link">发现战队 ↗</RouterLink>
      </div>
      <div v-if="teams.length" class="directory-grid">
        <TeamCard v-for="t in teams" :key="t.team_id" :team="t" />
      </div>
      <p v-else class="notice">
        还没有收藏的战队。在战队卡片上点爱心即可收藏。
      </p>
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
</template>
