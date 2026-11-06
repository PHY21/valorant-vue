<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, Heart, GitCompareArrows } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
import { compareStats, number, catalogRows } from "../lib/domain";
import Portrait from "../components/Portrait.vue";
import PlayerCard from "../components/PlayerCard.vue";
import Comments from "../components/Comments.vue";
const s = useCatalog(),
  route = useRoute();
const kind = computed(() => route.params.kind),
  id = computed(() => Number(route.params.id)),
  item = computed(() =>
    (kind.value === "player"
      ? s.players
      : catalogRows(s.data, kind.value)
    ).find((x) => x[kind.value + "_id"] === id.value),
  );
const title = computed(
  () => item.value?.ign || item.value?.[kind.value + "_name"],
);
const summary = computed(() =>
  kind.value === "player"
    ? compareStats(s.data.player_tournament_stats, id.value)
    : null,
);
const roster = computed(() => s.players.filter((p) => p.team_id === id.value));
const team = computed(() =>
  s.data.team.find((t) => t.team_id === item.value?.team_id),
);
const stats = computed(() =>
  s.data.player_tournament_stats.filter((x) => x.player_id === id.value),
);
const placements = computed(() =>
  s.data.team_tournament.filter((x) =>
    kind.value === "team"
      ? x.team_id === id.value
      : x.tournament_id === id.value,
  ),
);
const target = computed(() => `${kind.value}:${id.value}`);
</script>
<template>
  <RouterLink :to="'/explore/' + kind" class="back-link"
    ><ArrowLeft :size="16" /> 返回图鉴</RouterLink
  ><template v-if="item"
    ><section class="detail-hero">
      <Portrait v-if="kind === 'player'" :player="item" />
      <div v-else class="detail-symbol">
        {{
          item.team_tag || item.agent_name?.slice(0, 2) || item.tournament_year
        }}
      </div>
      <div>
        <span class="eyebrow">{{ kind.toUpperCase() }} / PROFILE</span>
        <h1>{{ title }}</h1>
        <p class="detail-meta">
          {{
            kind === "player"
              ? `${item.nationality} · ${item.player_role} · ${item.status}`
              : kind === "team"
                ? `成立于 ${item.founded_year || "未知年份"}`
                : kind === "agent"
                  ? `${item.agent_role} · ${item.origin}`
                  : `${item.tournament_level} · ${item.start_date} — ${item.end_date}`
          }}
        </p>
        <RouterLink
          v-if="team && kind === 'player'"
          :to="'/detail/team/' + team.team_id"
          class="tag"
          >{{ team.team_name }} ↗</RouterLink
        >
        <div v-if="kind === 'player'" class="detail-actions">
          <button
            class="btn secondary"
            :aria-pressed="s.favorites.includes(id)"
            @click="s.toggle(id)"
          >
            <Heart :size="16" />{{
              s.favorites.includes(id) ? "已收藏" : "收藏选手"
            }}</button
          ><RouterLink :to="'/compare?player=' + id" class="btn"
            ><GitCompareArrows :size="16" />对比选手</RouterLink
          >
        </div>
      </div>
    </section>
    <div v-if="summary" class="detail-stats">
      <div
        v-for="[key, label, digits] in [
          ['rating', '加权 RATING', 2],
          ['acs', '平均 ACS', 1],
          ['kd', '平均 K/D', 2],
          ['matches', '收录场次', 0],
        ]"
      >
        <span>{{ label }}</span
        ><strong>{{ number(summary[key], digits) }}</strong>
      </div>
    </div>
    <section class="panel bio-panel">
      <span class="eyebrow">THE STORY</span>
      <h2>关于{{ title }}</h2>
      <p>
        {{ item.bio || item.description || "当前数据集中尚未收录详细介绍。" }}
      </p>
      <p v-if="item.honors" class="preserve-lines">{{ item.honors }}</p>
      <p v-if="kind === 'agent' && item.skills" class="preserve-lines">
        {{ item.skills }}
      </p>
      <p v-if="kind === 'tournament'">
        收录奖金池：{{
          item.prize_pool == null ? "未收录" : "$" + number(item.prize_pool)
        }}
      </p>
    </section>
    <section v-if="kind === 'team'" class="section">
      <div class="section-heading">
        <h2>
          收录阵容 <span class="muted">{{ roster.length }}</span>
        </h2>
      </div>
      <div class="player-grid">
        <PlayerCard v-for="p in roster" :player="p" :key="p.player_id" />
      </div>
      <p v-if="!roster.length" class="notice">暂无收录选手。</p>
    </section>
    <section v-if="kind === 'player'" class="section">
      <div class="section-heading">
        <h2>赛事表现</h2>
        <span class="caption">原始收录记录 · 各赛事/特工可能分别统计</span>
      </div>
      <div v-if="stats.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>赛事</th>
              <th>场次</th>
              <th>ACS</th>
              <th>K/D</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in stats" :key="row.stat_id">
              <td>
                <RouterLink :to="'/detail/tournament/' + row.tournament_id"
                  >{{
                    s.data.tournament.find(
                      (t) => t.tournament_id === row.tournament_id,
                    )?.tournament_name || "未收录赛事"
                  }}
                  ↗</RouterLink
                >
              </td>
              <td>{{ row.matches_played }}</td>
              <td>{{ number(row.acs, 1) }}</td>
              <td>{{ number(row.kd, 2) }}</td>
              <td>{{ number(row.rating, 2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="notice">暂无这位选手的比赛数据。</p>
    </section>
    <section v-if="kind === 'team' || kind === 'tournament'" class="section">
      <h2>{{ kind === "team" ? "参赛记录" : "参赛战队" }}</h2>
      <div v-if="placements.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ kind === "team" ? "赛事" : "战队" }}</th>
              <th>名次</th>
              <th>胜场</th>
              <th>负场</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in placements" :key="p.id">
              <td>
                <RouterLink
                  :to="
                    kind === 'team'
                      ? '/detail/tournament/' + p.tournament_id
                      : '/detail/team/' + p.team_id
                  "
                  >{{
                    kind === "team"
                      ? s.data.tournament.find(
                          (t) => t.tournament_id === p.tournament_id,
                        )?.tournament_name
                      : s.data.team.find((t) => t.team_id === p.team_id)
                          ?.team_name
                  }}
                  ↗</RouterLink
                >
              </td>
              <td>{{ p.placement }}</td>
              <td>{{ p.wins }}</td>
              <td>{{ p.losses }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="notice">暂无参赛记录。</p>
    </section>
    <Comments v-if="kind !== 'agent'" :key="target" :target="target"
  /></template>
  <div v-else class="empty">
    <h1>没有找到这份档案</h1>
    <p>链接可能已失效，请回到图鉴重新选择。</p>
    <RouterLink to="/explore/player" class="btn">浏览选手</RouterLink>
  </div>
</template>
