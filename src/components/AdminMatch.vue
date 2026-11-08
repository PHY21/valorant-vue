<script setup>
import { ref, computed } from "vue";
import { useCatalog } from "../stores/catalog";
import { supabase } from "../lib/supabase";
import { adminError } from "../lib/admin";
import MatchCorrection from "./MatchCorrection.vue";
const mode = ref("add");
const catalog = useCatalog();
const teams = computed(() => catalog.data.team),
  teamName = (id) => teams.value.find((t) => t.team_id === id)?.team_name;
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
}).format(new Date());
const fresh = () => ({
  a: null,
  b: null,
  sa: 0,
  sb: 0,
  played: today,
  event_name: "",
  stage_name: "",
  link: "",
});
const form = ref(fresh()),
  preview = ref(null),
  message = ref(""),
  busy = ref(false);
function review() {
  message.value = "";
  const { link, ...m } = form.value;
  if (m.a === m.b || m.sa === m.sb) {
    message.value = "请选择不同的两支战队，并填写已分出胜负的最终比分。";
    return;
  }
  const id = link
    .trim()
    .match(
      /^https:\/\/(?:www\.)?vlr\.gg\/([1-9]\d{0,8})(?:\/[^?#\s]*)?(?:[?#].*)?$/i,
    );
  if (link.trim() && !id) {
    message.value =
      "比赛来源请填写 VLR 比赛详情页（网址中域名后面是数字），也可以留空。";
    return;
  }
  preview.value = { ...m, vlr_id: id ? Number(id[1]) : null };
}
async function save() {
  if (!preview.value || busy.value) return;
  busy.value = true;
  try {
    const { error } = await supabase.rpc("atlas_add_match", preview.value);
    if (error) throw error;
    preview.value = null;
    form.value = fresh();
    await catalog.load();
    message.value = catalog.error
      ? "赛果已发布，请刷新查看。"
      : "赛果已发布。首页动态和两队交手记录均已更新。";
  } catch (e) {
    message.value = adminError(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="segmented" aria-label="赛果管理">
    <button
      v-for="[key, name] in [
        ['add', '录入新赛果'],
        ['correct', '赛果纠错'],
      ]"
      :key="key"
      :class="{ selected: mode === key }"
      :aria-pressed="mode === key"
      @click="mode = key"
    >
      {{ name }}
    </button>
  </div>
  <MatchCorrection v-if="mode === 'correct'" />
  <section v-show="mode === 'add'" class="panel ops">
    <h2>录入已结束比赛</h2>
    <p class="caption">填入系列赛最终比分；发布前可以先核对对阵和获胜方。</p>
    <form @submit.prevent="review">
      <fieldset :disabled="!!preview || busy">
        <div class="ops-grid">
          <label
            >比赛日期<input
              type="date"
              required
              min="2020-01-01"
              :max="today"
              v-model="form.played"
          /></label>
          <label
            >赛事名称<input
              required
              maxlength="120"
              aria-label="赛事名称"
              list="events"
              v-model.trim="form.event_name"
              placeholder="选择已有赛事或输入新赛事" /><datalist id="events">
              <option
                v-for="e in catalog.data.tournament"
                :key="e.tournament_id"
                :value="e.tournament_name"
              ></option></datalist
          ></label>
          <label
            >阶段 / 轮次<input
              required
              maxlength="100"
              v-model.trim="form.stage_name"
              placeholder="例如：总决赛"
          /></label>
          <label
            >VLR 比赛链接（选填）<input
              v-model.trim="form.link"
              placeholder="https://www.vlr.gg/比赛编号/…"
          /></label>
          <template
            v-for="[side, score, title] in [
              ['a', 'sa', 'A'],
              ['b', 'sb', 'B'],
            ]"
            :key="side"
          >
            <label
              >战队 {{ title
              }}<select
                :aria-label="'战队 ' + title"
                required
                v-model="form[side]"
              >
                <option disabled :value="null">选择战队</option>
                <option v-for="t in teams" :key="t.team_id" :value="t.team_id">
                  {{ t.team_name }}
                </option>
              </select></label
            >
            <label
              >{{ title }} 队胜图数<input
                required
                type="number"
                min="0"
                max="3"
                step="1"
                v-model.number="form[score]" /></label
          ></template>
        </div>
        <button class="btn secondary">预览赛果</button>
      </fieldset>
    </form>
    <div v-if="preview" class="notice">
      <h3>
        {{ teamName(preview.a) }} {{ preview.sa }} : {{ preview.sb }}
        {{ teamName(preview.b) }}
      </h3>
      <p>
        {{ preview.played }} · {{ preview.event_name }} ·
        {{ preview.stage_name }}
      </p>
      <p>
        获胜：{{ teamName(preview.sa > preview.sb ? preview.a : preview.b) }}
      </p>
      <button class="btn" :disabled="busy" @click="save">确认发布赛果</button>
      <button
        class="btn secondary"
        :disabled="busy"
        @click="
          preview = null;
          message = '';
        "
      >
        返回修改
      </button>
    </div>
    <p v-if="message" role="status" class="notice">{{ message }}</p>
  </section>
</template>
