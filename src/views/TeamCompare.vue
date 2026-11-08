<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeftRight } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
import { headToHead, opponentCounts, teamRecord } from "../lib/teamResults";
import PageHeading from "../components/PageHeading.vue";
const s = useCatalog(),
  route = useRoute(),
  router = useRouter();
const teams = computed(() =>
  [...s.data.team].sort((a, b) => a.team_name.localeCompare(b.team_name)),
);
const matches = computed(() => s.data.team_matches || []);
const left = computed(
  () =>
    teams.value.find((t) => t.team_id === Number(route.query.team)) ||
    teams.value.find((t) => t.team_tag === "EDG") ||
    teams.value[0],
);
const counts = computed(() =>
  opponentCounts(matches.value, left.value.team_id),
);
const opponents = computed(() =>
  teams.value
    .filter((t) => t.team_id !== left.value.team_id)
    .sort(
      (a, b) =>
        (counts.value.get(b.team_id) || 0) - (counts.value.get(a.team_id) || 0),
    ),
);
const right = computed(
  () =>
    opponents.value.find((t) => t.team_id === Number(route.query.opponent)) ||
    (!route.query.team && opponents.value.find((t) => t.team_tag === "TH")) ||
    opponents.value[0],
);
const history = computed(() =>
  right.value
    ? headToHead(matches.value, left.value.team_id, right.value.team_id)
    : [],
);
const leftWins = computed(
  () => history.value.filter((m) => m.leftScore > m.rightScore).length,
);
const records = computed(() =>
  [left.value, right.value].map((t) => teamRecord(matches.value, t?.team_id)),
);
const tournaments = computed(
  () =>
    new Map(s.data.tournament.map((t) => [t.tournament_id, t.tournament_name])),
);
function selectPair(a, b) {
  const query = { team: String(a) };
  if (b && a !== b) query.opponent = String(b);
  router.replace({ path: "/compare/teams", query });
}
function region(t) {
  return s.data.region.find((r) => r.region_id === t.region_id)?.region_code;
}
</script>
<template>
  <PageHeading
    eyebrow="HEAD TO HEAD"
    title="战队对比"
    description="选择两支战队，查看交手胜负、地图比分与比赛记录。"
  />
  <div class="compare-pickers">
    <label
      >战队 A<select
        :value="left.team_id"
        @change="selectPair(Number($event.target.value), right?.team_id)"
      >
        <option v-for="t in teams" :key="t.team_id" :value="t.team_id">
          {{ t.team_name }} · {{ t.team_tag }}
        </option>
      </select></label
    >
    <button
      v-if="right"
      class="swap-sides"
      aria-label="交换两支战队"
      @click="selectPair(right.team_id, left.team_id)"
    >
      <ArrowLeftRight :size="20" />
    </button>
    <label
      >战队 B<select
        :value="right?.team_id"
        @change="selectPair(left.team_id, Number($event.target.value))"
      >
        <option v-for="t in opponents" :key="t.team_id" :value="t.team_id">
          {{ t.team_name }} · {{ counts.get(t.team_id) || 0 }} 场交手
        </option>
      </select></label
    >
  </div>
  <template v-if="right">
    <section class="match-summary panel" aria-label="交手胜场汇总">
      <div v-for="(t, i) in [left, right]" :key="t.team_id" class="match-side">
        <span class="eyebrow">{{ region(t) }}</span>
        <RouterLink :to="'/detail/team/' + t.team_id"
          ><strong>{{ t.team_tag }}</strong
          ><span>{{ t.team_name }} ↗</span></RouterLink
        >
        <b>{{ i === 0 ? leftWins : history.length - leftWins }} 胜</b>
      </div>
    </section>
    <section class="section">
      <div class="section-heading">
        <h2>直接交手</h2>
        <span class="caption">收录 {{ history.length }} 场 · 按日期倒序</span>
      </div>
      <div v-if="history.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>赛事 / 轮次</th>
              <th>{{ left.team_tag }} : {{ right.team_tag }}</th>
              <th>胜方</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in history" :key="m.id">
              <td>{{ m.date }}</td>
              <td>
                {{ m.event_name || tournaments.get(m.tournament_id)
                }}<small>{{ m.stage }}{{ m.revision ? " · 比分已更正" : "" }}</small>
              </td>
              <td class="map-score">{{ m.leftScore }} : {{ m.rightScore }}</td>
              <td>
                {{
                  m.leftScore > m.rightScore ? left.team_tag : right.team_tag
                }}
              </td>
              <td>
                <a
                  v-if="m.id > 0"
                  :href="'https://www.vlr.gg/' + m.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="m.date + ' 比赛原始记录'"
                  >VLR.gg ↗</a
                ><span v-else>后台录入</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="notice">
        当前收录范围内没有这两队的直接交手记录。可在「战队
        B」中选择标有交手场次的队伍。
      </p>
      <p class="method-note">
        收录 2024–2026 年 VCT
        四大赛区启点赛、两个赛段、大师赛和全球冠军赛中，双方均在本站图鉴且有明确比分的系列赛。比分表示各自赢下的地图数，日期按
        VLR.gg
        赛程页记录。后台补录的已结束比赛也计入统计；没有来源链接的场次标为「后台录入」。
      </p>
    </section>
    <section class="section">
      <div class="section-heading">
        <h2>各队整体表现</h2>
        <span class="caption">对所有已收录对手</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>战队</th>
              <th>系列赛胜 / 负</th>
              <th>系列赛胜率</th>
              <th>地图胜 / 负</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in records" :key="i">
              <th>{{ i === 0 ? left.team_tag : right.team_tag }}</th>
              <td>
                {{ r.series ? r.wins + " / " + (r.series - r.wins) : "—" }}
              </td>
              <td>
                {{
                  r.series ? ((r.wins * 100) / r.series).toFixed(1) + "%" : "—"
                }}
              </td>
              <td>{{ r.series ? r.mapsWon + " / " + r.mapsLost : "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
<style scoped>
.swap-sides {
  display: grid;
  place-items: center;
  color: inherit;
  border: 1px solid var(--line);
  background: #fff;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  align-self: end;
}
.match-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: #e8ecdf;
  padding: clamp(16px, 3vw, 32px);
  gap: 16px;
}
.match-side + .match-side {
  border-left: 1px solid #b9c3b1;
  padding-left: clamp(14px, 3vw, 32px);
}
.match-side a {
  display: grid;
  gap: 3px;
  margin: 8px 0 16px;
  overflow-wrap: anywhere;
}
.match-side strong {
  font-size: clamp(28px, 5vw, 52px);
  line-height: 1;
}
.match-side b {
  font-size: 1.3rem;
}
td small {
  display: block;
  color: var(--muted);
  margin-top: 4px;
}
.map-score {
  font-weight: 750;
  white-space: nowrap;
}
@media (max-width: 680px) {
  .compare-pickers {
    grid-template-columns: minmax(0, 1fr);
  }
  .swap-sides {
    justify-self: center;
  }
}
</style>
