<script setup>
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, Heart, GitCompareArrows, Trash2 } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
import { compareStats, number, catalogRows } from "../lib/domain";
import Portrait from "../components/Portrait.vue";
import PlayerCard from "../components/PlayerCard.vue";
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
const comments = computed(() =>
  s.comments.filter((c) => c.target === target.value),
);
const name = ref(""),
  text = ref(""),
  rating = ref(5),
  message = ref("");
watch(target, () => {
  text.value = "";
  message.value = "";
  rating.value = 5;
});
function submit() {
  if (!name.value.trim() || !text.value.trim()) {
    message.value = "请填写昵称和评价内容。";
    return;
  }
  s.addComment({
    target: target.value,
    name: name.value.trim().slice(0, 24),
    text: text.value.trim().slice(0, 500),
    rating: Number(rating.value),
  });
  text.value = "";
  message.value = "已保存到当前浏览器。";
}
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
    <section v-if="kind !== 'agent'" class="panel comments-panel">
      <span class="eyebrow">YOUR TAKE</span>
      <h2>留下你的看法</h2>
      <p class="method-note">
        本地交互演示：评价仅保存在当前浏览器，不会发布到服务器，也不会被其他访客看到。
      </p>
      <form @submit.prevent="submit">
        <div class="form-row">
          <label
            >昵称<input
              v-model="name"
              maxlength="24"
              required
              placeholder="如何称呼你"
              autocomplete="nickname" /></label
          ><label
            >评分<select v-model="rating">
              <option v-for="n in 5" :value="n">
                {{ "★".repeat(n) }} · {{ n }} 分
              </option>
            </select></label
          >
        </div>
        <label
          >评价<textarea
            v-model="text"
            maxlength="500"
            required
            rows="3"
            placeholder="聊聊你欣赏的表现…"
          ></textarea>
        </label>
        <div class="comment-submit">
          <span class="caption">{{ text.length }} / 500</span
          ><button class="btn" type="submit">保存本地评价 ↗</button>
        </div>
        <p role="status" class="caption">{{ message }}</p>
      </form>
      <div v-for="c in comments" :key="c.id" class="comment">
        <div>
          <strong>{{ c.name }}</strong
          ><span class="rating-stars">{{ "★".repeat(c.rating) }}</span
          ><span class="caption">{{
            new Date(c.date).toLocaleDateString("zh-CN")
          }}</span
          ><button
            class="icon-btn"
            :aria-label="'删除 ' + c.name + ' 的本地评价'"
            @click="s.removeComment(c.id)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
        <p>{{ c.text }}</p>
      </div>
      <p v-if="!comments.length" class="caption">这里还没有本地评价。</p>
    </section></template
  >
  <div v-else class="empty">
    <h1>没有找到这份档案</h1>
    <p>链接可能已失效，请回到图鉴重新选择。</p>
    <RouterLink to="/explore/player" class="btn">浏览选手</RouterLink>
  </div>
</template>
