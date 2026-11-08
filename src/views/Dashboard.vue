<script setup>
import { computed } from "vue";
import { ArrowUpRight, ArrowRight, MoveUpRight } from "lucide-vue-next";
import { useCatalog } from "../stores/catalog";
import PlayerCard from "../components/PlayerCard.vue";
import Portrait from "../components/Portrait.vue";
import { rankPlayers, number } from "../lib/domain";
const s = useCatalog();
const names = ["ZmjjKK", "aspas", "CHICHOO", "f0rsakeN"];
const featured = computed(() =>
  names.map((n) => s.players.find((p) => p.ign === n)).filter(Boolean),
);
const hero = computed(() => featured.value[0] || s.players[0]);
const ranking = computed(() =>
  rankPlayers(s.players, s.data.player_tournament_stats).slice(0, 5),
);
const events = computed(() =>
  [...s.data.tournament]
    .sort(
      (a, b) =>
        b.tournament_year - a.tournament_year ||
        b.tournament_id - a.tournament_id,
    )
    .slice(0, 3),
);
</script>
<template>
  <section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">
        <span class="status-dot"></span> THE WORLD OF VALORANT
      </div>
      <h1>每个名字，<br />都有自己的<span class="hero-accent">高光。</span></h1>
      <p>
        从一位选手，到一个赛场。<br />探索职业选手、战队与赛事背后的数据故事。
      </p>
      <div class="hero-actions">
        <RouterLink to="/explore/player" class="btn"
          >探索选手图鉴 <ArrowUpRight :size="18" /></RouterLink
        ><RouterLink to="/compare" class="text-link"
          >来场数据对决 <ArrowRight :size="17"
        /></RouterLink>
      </div>
      <div class="hero-index">01 — EXPLORE THE GAME</div>
    </div>
    <div class="hero-art">
      <div class="hero-outline">VALORANT</div>
      <Portrait :player="hero" />
      <div class="hero-player">
        <span class="tag dark">FEATURED PLAYER</span
        ><strong>{{ hero.ign }}</strong
        ><span>{{ hero.team_tag }} / {{ hero.player_role }}</span>
      </div>
      <span class="hero-corner">CN<br />↗</span>
    </div>
  </section>
  <section class="stat-strip" aria-label="图鉴数据概览">
    <div
      v-for="[value, label, en] in [
        [s.players.length, '职业选手', 'PLAYERS'],
        [s.data.team.length, '职业战队', 'TEAMS'],
        [s.data.tournament.length, '收录赛事', 'EVENTS'],
        [s.data.agent.length, '特工档案', 'AGENTS'],
      ]"
      :key="en"
    >
      <span class="stat-number">{{ value }}<span>+</span></span>
      <div>
        {{ label }}<small>{{ en }}</small>
      </div>
    </div>
  </section>
  <section v-if="s.data.news?.length" class="panel ops">
    <span class="eyebrow">FROM THE DESK</span>
    <h2>赛场动态</h2>
    <RouterLink
      v-for="(n, i) in s.data.news.slice(0, 10)"
      :key="i"
      class="news-item"
      :to="
        n.player_id
          ? '/detail/player/' + n.player_id
          : {
              path: '/compare/teams',
              query: { team: n.team_a, opponent: n.team_b },
            }
      "
      ><b>{{ n.kind }}</b
      >{{ n.title }} ↗<small>{{
        n.detail || new Date(n.at).toLocaleDateString("zh-CN")
      }}</small></RouterLink
    >
  </section>
  <section class="section">
    <div class="section-heading">
      <div>
        <span class="eyebrow">IN THE SPOTLIGHT</span>
        <h2>聚光灯下的选手</h2>
      </div>
      <RouterLink to="/explore/player" class="text-link"
        >全部选手 <ArrowUpRight :size="17"
      /></RouterLink>
    </div>
    <div class="player-grid">
      <PlayerCard v-for="p in featured" :key="p.player_id" :player="p" />
    </div>
  </section>
  <div class="dashboard-lower">
    <section class="panel">
      <div class="section-heading compact">
        <div>
          <span class="eyebrow">BY THE NUMBERS</span>
          <h2>实力，看得见</h2>
        </div>
        <RouterLink to="/rankings" aria-label="查看数据排行榜" class="icon-btn"
          ><ArrowUpRight
        /></RouterLink>
      </div>
      <p class="caption">课程数据 · 按场次加权 Rating · 至少 3 场</p>
      <RouterLink
        class="mini-ranking"
        v-for="(p, i) in ranking"
        :key="p.player_id"
        :to="'/detail/player/' + p.player_id"
        ><span class="rank-no">0{{ i + 1 }}</span
        ><Portrait :player="p" />
        <div>
          <strong>{{ p.ign }}</strong
          ><small>{{ p.team_tag }}</small>
        </div>
        <div class="rank-bar">
          <span
            :style="{ width: (p.value / ranking[0].value) * 100 + '%' }"
          ></span>
        </div>
        <b>{{ number(p.value, 2) }}</b></RouterLink
      >
    </section>
    <section class="panel event-panel">
      <div class="section-heading compact">
        <div>
          <span class="eyebrow">THE COMPETITIVE STAGE</span>
          <h2>赛场档案</h2>
        </div>
        <RouterLink
          to="/explore/tournament"
          class="icon-btn"
          aria-label="查看赛事中心"
          ><ArrowUpRight
        /></RouterLink>
      </div>
      <RouterLink
        class="event-row"
        v-for="(t, i) in events"
        :key="t.tournament_id"
        :to="'/detail/tournament/' + t.tournament_id"
        ><span class="event-icon">{{ String(i + 1).padStart(2, "0") }}</span>
        <div>
          <span class="caption"
            >{{ t.tournament_year }} · {{ t.tournament_level }}</span
          >
          <h3>{{ t.tournament_name }}</h3>
          <span class="caption">{{ t.start_date }} — {{ t.end_date }}</span>
        </div>
        <MoveUpRight :size="17" /></RouterLink
      ><RouterLink to="/explore/tournament" class="event-more"
        >打开完整赛事档案 <ArrowRight :size="17"
      /></RouterLink>
    </section>
  </div>
</template>
