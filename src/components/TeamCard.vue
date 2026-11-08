<script setup>
import { computed } from "vue";
import { Heart } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
const props = defineProps({ team: { type: Object, required: true } });
const store = useCatalog();
const saved = computed(() => store.teamFavorites.includes(props.team.team_id));
const region = computed(
  () =>
    store.data.region.find((r) => r.region_id === props.team.region_id)
      ?.region_code,
);
</script>
<template>
  <article class="directory-card team-card">
    <RouterLink :to="'/detail/team/' + team.team_id" class="team-profile-link">
      <span class="tile-symbol team">{{ team.team_tag }}</span>
      <span class="eyebrow">{{ region }}</span>
      <h3>{{ team.team_name }}</h3>
      <p>
        {{
          store.players.filter((p) => p.team_id === team.team_id).length
        }}
        名收录选手<span v-if="team.founded_year">
          · 成立于 {{ team.founded_year }}</span
        >
      </p>
    </RouterLink>
    <button
      class="save-btn"
      :class="{ saved }"
      :aria-pressed="saved"
      :aria-label="(saved ? '取消收藏 ' : '收藏 ') + team.team_name"
      @click="store.toggle(team.team_id, 'team')"
    >
      <Heart :size="17" />
    </button>
    <RouterLink :to="'/compare/teams?team=' + team.team_id" class="card-bottom"
      >对比战队 <span>↗</span></RouterLink
    >
  </article>
</template>
<style scoped>
.team-card {
  position: relative;
}
.team-profile-link {
  display: block;
}
.team-profile-link .tile-symbol {
  margin-bottom: 18px;
}
</style>
