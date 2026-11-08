<script setup>
import { computed, ref, watch } from "vue";
import { useCatalog } from "../stores/catalog";
import { supabase } from "../lib/supabase";
import { adminError } from "../lib/admin";

const catalog = useCatalog();
const query = ref(""),
  limit = ref(15),
  selected = ref(null),
  scoreA = ref(0),
  scoreB = ref(0),
  reason = ref("");
const preview = ref(false),
  busy = ref(false),
  message = ref("");
const teams = computed(
  () => new Map(catalog.data.team.map((team) => [team.team_id, team])),
);
const events = computed(
  () =>
    new Map(
      catalog.data.tournament.map((t) => [t.tournament_id, t.tournament_name]),
    ),
);
const teamName = (id) => teams.value.get(id)?.team_name || "未知战队";
const eventName = (match) =>
  match.event_name || events.value.get(match.tournament_id) || "未命名赛事";
const matches = computed(() => {
  const tokens = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (catalog.data.team_matches || [])
    .filter((match) => {
      const names = [
        match.id,
        match.date,
        eventName(match),
        match.stage,
        ...[match.team_a, match.team_b].flatMap((id) => [
          teamName(id),
          teams.value.get(id)?.team_tag,
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => names.includes(token));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
});
watch(query, () => (limit.value = 15));
function pick(match) {
  selected.value = { ...match };
  scoreA.value = match.score_a;
  scoreB.value = match.score_b;
  reason.value = "";
  message.value = "";
  preview.value = false;
}
const valid = computed(
  () =>
    selected.value &&
    [scoreA.value, scoreB.value].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 3,
    ) &&
    scoreA.value !== scoreB.value &&
    (scoreA.value !== selected.value.score_a ||
      scoreB.value !== selected.value.score_b) &&
    reason.value.trim().length > 0,
);
function winner(a, b) {
  return teamName(a > b ? selected.value.team_a : selected.value.team_b);
}
async function publish() {
  if (!valid.value || !preview.value || busy.value) return;
  busy.value = true;
  message.value = "";
  try {
    const m = selected.value;
    const { data, error } = await supabase.rpc("atlas_correct_match", {
      mid: m.id,
      expected_a: m.score_a,
      expected_b: m.score_b,
      expected_revision: m.revision || 0,
      new_a: scoreA.value,
      new_b: scoreB.value,
      reason: reason.value.trim(),
    });
    if (error) throw error;
    selected.value = null;
    preview.value = false;
    await catalog.load();
    message.value =
      "比分已更正，已向 " +
      data +
      " 位原收件人发送提醒。" +
      (catalog.error ? "请刷新读取最新战绩。" : "");
  } catch (error) {
    if (error?.message?.includes("STALE_MATCH")) {
      await catalog.load();
      selected.value = null;
      preview.value = false;
      message.value =
        "其他管理员已更新这场比赛，请重新选择比赛并核对最新比分。";
    } else message.value = adminError(error);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="panel ops">
    <h2>更正已发布赛果</h2>
    <p v-if="message" role="status" class="notice">{{ message }}</p>
    <template v-if="!selected">
      <label
        >查找比赛<input
          v-model="query"
          type="search"
          placeholder="输入战队、赛事、日期或比赛编号"
      /></label>
      <p class="caption">找到 {{ matches.length }} 场比赛</p>
      <article
        v-for="m in matches.slice(0, limit)"
        :key="m.id"
        class="match-row"
      >
        <div>
          <small>{{ m.date }} · {{ eventName(m) }} · {{ m.stage }}</small
          ><strong
            >{{ teamName(m.team_a) }} {{ m.score_a }} : {{ m.score_b }}
            {{ teamName(m.team_b) }}</strong
          >
        </div>
        <button class="btn secondary" :disabled="busy" @click="pick(m)">
          更正比分
        </button>
      </article>
      <button
        v-if="limit < matches.length"
        class="btn secondary"
        @click="limit += 15"
      >
        显示更多比赛
      </button>
    </template>
    <template v-else>
      <p>
        {{ selected.date }} · {{ eventName(selected) }} · {{ selected.stage }} ·
        #{{ selected.id }}
      </p>
      <h3>
        {{ teamName(selected.team_a) }} 对 {{ teamName(selected.team_b) }}
      </h3>
      <p>
        已发布比分
        <strong>{{ selected.score_a }} : {{ selected.score_b }}</strong> ·
        获胜方 {{ winner(selected.score_a, selected.score_b) }}
      </p>
      <form v-if="!preview" @submit.prevent="valid && (preview = true)">
        <div class="ops-grid">
          <label
            >{{ teamName(selected.team_a) }} 胜图数<input
              v-model.number="scoreA"
              required
              type="number"
              min="0"
              max="3"
              step="1"
          /></label>
          <label
            >{{ teamName(selected.team_b) }} 胜图数<input
              v-model.number="scoreB"
              required
              type="number"
              min="0"
              max="3"
              step="1"
          /></label>
        </div>
        <label
          >更正原因（收件人可见）<input
            v-model.trim="reason"
            required
            maxlength="200"
            placeholder="例如：原记录中两队的比分填反"
        /></label>
        <button class="btn" :disabled="!valid">预览更正</button>
        <button type="button" class="btn secondary" @click="selected = null">
          重新选比赛
        </button>
      </form>
      <div v-else class="notice">
        <h3>核对比分更正</h3>
        <p>
          <b
            >{{ selected.score_a }} : {{ selected.score_b }} → {{ scoreA }} :
            {{ scoreB }}</b
          >
          · 更正后获胜方 {{ winner(scoreA, scoreB) }}
        </p>
        <p>原因：{{ reason }}</p>
        <p>发布后将更新这场比赛的交手统计，并提醒收到过原赛果的用户。</p>
        <button class="btn" :disabled="busy" @click="publish">
          确认发布更正
        </button>
        <button class="btn secondary" :disabled="busy" @click="preview = false">
          返回修改
        </button>
      </div>
    </template>
  </section>
</template>
<style scoped>
.match-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--line);
  padding: 12px 0;
}
.match-row small,
.match-row strong {
  display: block;
}
.match-row small {
  color: var(--muted);
}
.match-row .btn {
  flex: none;
}
</style>
