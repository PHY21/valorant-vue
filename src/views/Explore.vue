<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Search, ArrowUpRight, SlidersHorizontal } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
import { filterPlayers, number, catalogRows } from "../lib/domain";
import PageHeading from "../components/PageHeading.vue";
import PlayerCard from "../components/PlayerCard.vue";
const s = useCatalog(),
  route = useRoute(),
  router = useRouter();
const kind = computed(() => route.params.kind);
const config = {
  player: [
    "选手图鉴",
    "PLAYER DIRECTORY",
    "认识赛场上的每一个名字。按战队、赛区和定位，找到你关注的选手。",
  ],
  team: ["战队档案", "TEAM ARCHIVE", "从赛区到阵容，探索每支战队的故事。"],
  tournament: [
    "赛事中心",
    "EVENT ARCHIVE",
    "通过名称、年份与级别，回顾收录的赛事。",
  ],
  agent: [
    "特工图鉴",
    "AGENT PROTOCOL",
    "认识每一种定位，找到适合你的战术角色。",
  ],
};
const meta = computed(() =>
  Object.hasOwn(config, kind.value) ? config[kind.value] : null,
);
const q = ref(""),
  region = ref(""),
  role = ref(""),
  year = ref(""),
  level = ref(""),
  page = ref(1);
watch(
  () => route.fullPath,
  () => {
    q.value = String(route.query.q || "");
    region.value = String(route.query.region || "");
    role.value = String(route.query.role || "");
    year.value = String(route.query.year || "");
    level.value = String(route.query.level || "");
    page.value = 1;
  },
  { immediate: true },
);
function sync() {
  router.replace({
    path: route.path,
    query: Object.fromEntries(
      Object.entries({
        q: q.value,
        region: region.value,
        role: role.value,
        year: year.value,
        level: level.value,
      }).filter(([, v]) => v),
    ),
  });
}
function reset() {
  q.value = region.value = role.value = year.value = level.value = "";
  sync();
}
const regions = computed(() => s.data.region);
const roles = computed(() =>
  [...new Set(s.players.map((p) => p.player_role))].filter(Boolean),
);
const years = computed(() =>
  [...new Set(s.data.tournament.map((t) => t.tournament_year))].sort(
    (a, b) => b - a,
  ),
);
const levels = computed(() => [
  ...new Set(s.data.tournament.map((t) => t.tournament_level)),
]);
const filtered = computed(() => {
  if (kind.value === "player")
    return filterPlayers(s.players, {
      q: q.value,
      region: region.value,
      role: role.value,
    });
  const name = {
    team: "team_name",
    tournament: "tournament_name",
    agent: "agent_name",
  }[kind.value];
  return catalogRows(s.data, kind.value)
    .filter(
      (x) =>
        (!q.value.trim() ||
          `${x[name]} ${x.team_tag || ""}`
            .toLowerCase()
            .includes(q.value.trim().toLowerCase())) &&
        (!region.value ||
          s.data.region.find((r) => r.region_id === x.region_id)
            ?.region_code === region.value) &&
        (!year.value || x.tournament_year === Number(year.value)) &&
        (!level.value || x.tournament_level === level.value) &&
        (!role.value || x.agent_role === role.value),
    )
    .sort((a, b) =>
      kind.value === "tournament"
        ? b.tournament_year - a.tournament_year ||
          b.tournament_id - a.tournament_id
        : 0,
    );
});
const pages = computed(() => Math.ceil(filtered.value.length / 24));
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * 24, page.value * 24),
);
watch([q, region, role, year, level], () => (page.value = 1));
</script>
<template>
  <template v-if="meta"
    ><PageHeading :eyebrow="meta[1]" :title="meta[0]" :description="meta[2]" />
    <div class="filter-panel">
      <label class="search-field"
        ><Search :size="19" /><input
          v-model="q"
          :aria-label="'搜索' + meta[0]"
          :placeholder="
            kind === 'player' ? '搜索选手 ID、姓名或战队…' : '搜索名称…'
          "
          @input="sync"
      /></label>
      <div class="filters">
        <SlidersHorizontal :size="17" /><select
          v-if="['player', 'team'].includes(kind)"
          v-model="region"
          aria-label="赛区筛选"
          @change="sync"
        >
          <option value="">全部赛区</option>
          <option v-for="r in regions" :value="r.region_code">
            {{ r.region_code }}
          </option></select
        ><select
          v-if="kind === 'player' || kind === 'agent'"
          v-model="role"
          aria-label="定位筛选"
          @change="sync"
        >
          <option value="">全部定位</option>
          <option
            v-for="r in kind === 'player'
              ? roles
              : [...new Set(s.data.agent.map((a) => a.agent_role))]"
            :value="r"
          >
            {{ r }}
          </option></select
        ><template v-if="kind === 'tournament'"
          ><select v-model="year" aria-label="年份筛选" @change="sync">
            <option value="">全部年份</option>
            <option v-for="y in years" :value="y">{{ y }}</option></select
          ><select v-model="level" aria-label="级别筛选" @change="sync">
            <option value="">全部级别</option>
            <option v-for="l in levels" :value="l">{{ l }}</option>
          </select></template
        ><button class="text-button" @click="reset">重置</button>
      </div>
    </div>
    <div class="result-line">
      <span
        >找到 <strong>{{ filtered.length }}</strong> 个结果</span
      ><span>COURSE COLLECTION / {{ kind.toUpperCase() }}</span>
    </div>
    <div v-if="!filtered.length" class="empty">
      <Search :size="34" />
      <h2>还没有找到匹配结果</h2>
      <p>试试其他关键词，或清除筛选条件。</p>
      <button class="btn" @click="reset">清除筛选</button>
    </div>
    <div v-else :class="kind === 'player' ? 'player-grid' : 'directory-grid'">
      <template v-for="item in visible" :key="item[kind + '_id']"
        ><PlayerCard v-if="kind === 'player'" :player="item" /><RouterLink
          v-else
          :to="`/detail/${kind}/${item[kind + '_id']}`"
          class="directory-card"
          ><div class="directory-card-top">
            <span class="tile-symbol" :class="kind">{{
              kind === "team"
                ? item.team_tag
                : kind === "agent"
                  ? item.agent_name.slice(0, 2)
                  : item.tournament_year
            }}</span
            ><ArrowUpRight :size="20" />
          </div>
          <span class="eyebrow">{{
            kind === "team"
              ? s.data.region.find((r) => r.region_id === item.region_id)
                  ?.region_code
              : kind === "agent"
                ? item.agent_role
                : item.tournament_level
          }}</span>
          <h3>{{ item[kind + "_name"] }}</h3>
          <p v-if="kind === 'team'">
            {{
              s.players.filter((p) => p.team_id === item.team_id).length
            }}
            名收录选手 · 成立于 {{ item.founded_year || "未知年份" }}
          </p>
          <p v-if="kind === 'agent'">
            {{ item.origin }} · {{ item.description }}
          </p>
          <p v-if="kind === 'tournament'">
            {{ item.start_date }} — {{ item.end_date }}<br />奖金池
            {{
              item.prize_pool == null ? "未收录" : "$" + number(item.prize_pool)
            }}
          </p>
          <span class="card-bottom">查看档案 <span>↗</span></span></RouterLink
        ></template
      >
    </div>
    <div v-if="pages > 1" class="pagination">
      <button class="btn secondary" :disabled="page === 1" @click="page--">
        上一页</button
      ><span>第 {{ page }} / {{ pages }} 页</span
      ><button class="btn secondary" :disabled="page === pages" @click="page++">
        下一页
      </button>
    </div></template
  >
  <div v-else class="empty">
    <h1>这个分类不存在</h1>
    <RouterLink to="/" class="btn">返回总览</RouterLink>
  </div>
</template>
