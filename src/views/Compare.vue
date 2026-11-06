<script setup>
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useCatalog } from "../stores/catalog";
import { compareStats, number } from "../lib/domain";
import PageHeading from "../components/PageHeading.vue";
import Portrait from "../components/Portrait.vue";
const s = useCatalog(),
  route = useRoute();
const a = ref(
    Number(route.query.player) ||
      s.players.find((p) => p.ign === "ZmjjKK")?.player_id ||
      1,
  ),
  b = ref(s.players.find((p) => p.ign === "aspas")?.player_id || 2);
const left = computed(() =>
    s.players.find((p) => p.player_id === Number(a.value)),
  ),
  right = computed(() =>
    s.players.find((p) => p.player_id === Number(b.value)),
  );
const sa = computed(() =>
    compareStats(s.data.player_tournament_stats, a.value),
  ),
  sb = computed(() => compareStats(s.data.player_tournament_stats, b.value));
const sorted = computed(() =>
  [...s.players].sort((a, b) => a.ign.localeCompare(b.ign)),
);
</script>
<template>
  <PageHeading
    eyebrow="HEAD TO HEAD"
    title="同场对比，各有锋芒"
    description="选择两位选手，从不同数据维度认识他们的表现。"
  />
  <div class="compare-pickers">
    <label
      >选手 A<select v-model="a">
        <option v-for="p in sorted" :value="p.player_id">
          {{ p.ign }} · {{ p.team_tag }}
        </option>
      </select></label
    ><span>VS</span
    ><label
      >选手 B<select v-model="b">
        <option v-for="p in sorted" :value="p.player_id">
          {{ p.ign }} · {{ p.team_tag }}
        </option>
      </select></label
    >
  </div>
  <div v-if="a === b" class="notice" role="status">
    当前选中了同一位选手。请选择另一位选手进行对比。
  </div>
  <div class="compare-profiles">
    <RouterLink
      v-for="p in [left, right]"
      :to="p ? '/detail/player/' + p.player_id : '/explore/player'"
      class="compare-profile"
      ><Portrait :player="p" />
      <div>
        <span class="eyebrow">{{ p?.team_tag }}</span>
        <h2>{{ p?.ign || "选手不存在" }}</h2>
        <p>{{ p?.nationality }} / {{ p?.player_role }}</p>
      </div></RouterLink
    >
  </div>
  <section class="panel comparison-data">
    <div
      v-for="[key, label, digits] in [
        ['rating', 'Rating', 2],
        ['acs', '平均战斗评分 ACS', 1],
        ['kd', '击杀 / 死亡 K/D', 2],
        ['matches', '收录比赛场次', 0],
      ]"
      class="compare-row"
    >
      <b
        :class="{
          better: a !== b && sa?.[key] > sb?.[key] && sb?.[key] != null,
        }"
        >{{ number(sa?.[key], digits) }}</b
      >
      <div>
        <span>{{ label }}</span>
        <div class="dual-bars">
          <i
            :style="{
              width:
                sa?.[key] != null
                  ? (sa[key] / Math.max(sa?.[key] || 0, sb?.[key] || 0, 1)) *
                      100 +
                    '%'
                  : '0%',
            }"
          ></i
          ><i
            :style="{
              width:
                sb?.[key] != null
                  ? (sb[key] / Math.max(sa?.[key] || 0, sb?.[key] || 0, 1)) *
                      100 +
                    '%'
                  : '0%',
            }"
          ></i>
        </div>
      </div>
      <b
        :class="{
          better: a !== b && sb?.[key] > sa?.[key] && sa?.[key] != null,
        }"
        >{{ number(sb?.[key], digits) }}</b
      >
    </div>
    <p class="method-note">
      按收录场次加权计算指标；“—”表示未收录数据。参赛时期、对手和样本数量不同，对比不构成实力结论。
    </p>
  </section>
</template>
