<script setup>
import { ref, computed } from "vue";
import { useCatalog } from "../stores/catalog";
import { rankPlayers, number } from "../lib/domain";
import PageHeading from "../components/PageHeading.vue";
import Portrait from "../components/Portrait.vue";
const s = useCatalog(),
  tournament = ref(""),
  metric = ref("rating");
const rows = computed(() =>
  rankPlayers(s.players, s.data.player_tournament_stats, {
    tournament: tournament.value,
    metric: metric.value,
  }).slice(0, 30),
);
const metrics = { rating: "Rating", acs: "ACS", kd: "K/D" };
</script>
<template>
  <PageHeading
    eyebrow="PERFORMANCE INDEX"
    title="让数据发声"
    description="把赛场表现放在同一个维度，发现值得关注的名字。"
  />
  <div class="filter-panel">
    <label class="select-label"
      >赛事范围<select v-model="tournament" aria-label="排行榜赛事">
        <option value="">全部收录赛事</option>
        <option
          v-for="t in [...s.data.tournament].reverse()"
          :value="t.tournament_id"
        >
          {{ t.tournament_name }}
        </option>
      </select></label
    >
    <div class="segmented" aria-label="排行指标">
      <button
        v-for="(label, key) in metrics"
        :class="{ selected: metric === key }"
        :aria-pressed="metric === key"
        @click="metric = key"
      >
        {{ label }}
      </button>
    </div>
  </div>
  <p class="method-note">
    统计口径：按收录比赛场次加权计算均值，累计至少 3
    场；数据来自课程数据集，不代表官方排名。
  </p>
  <div v-if="!rows.length" class="empty">
    <h2>该赛事没有满足条件的选手数据</h2>
    <button class="btn" @click="tournament = ''">查看全部赛事</button>
  </div>
  <div v-else class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>排名</th>
          <th>选手 / 战队</th>
          <th>Rating</th>
          <th>ACS</th>
          <th>K/D</th>
          <th>收录场次</th>
          <th>表现指数</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(p, i) in rows" :key="p.player_id">
          <td>
            <span class="rank-badge" :class="{ podium: i < 3 }">{{
              String(i + 1).padStart(2, "0")
            }}</span>
          </td>
          <td>
            <RouterLink
              :to="'/detail/player/' + p.player_id"
              class="table-player"
              ><Portrait :player="p" /><span
                ><strong>{{ p.ign }}</strong
                ><small>{{ p.team_tag }}</small></span
              ></RouterLink
            >
          </td>
          <td :class="{ metric: metric === 'rating' }">
            {{ number(p.rating, 2) }}
          </td>
          <td :class="{ metric: metric === 'acs' }">{{ number(p.acs, 1) }}</td>
          <td :class="{ metric: metric === 'kd' }">{{ number(p.kd, 2) }}</td>
          <td>{{ p.matches }}</td>
          <td>
            <div class="rank-bar">
              <span
                :style="{ width: (p.value / rows[0].value) * 100 + '%' }"
              ></span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
