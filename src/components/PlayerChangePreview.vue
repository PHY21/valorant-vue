<script setup>
import { computed } from "vue";
import Portrait from "./Portrait.vue";
import { labels } from "../lib/admin";

const props = defineProps({
  player: { type: Object, required: true },
  profile: Object,
  changes: { type: Array, required: true },
  selected: { type: Array, required: true },
  valueText: { type: Function, required: true },
  busy: Boolean,
  note: String,
});
const emit = defineEmits(["update:selected", "publish", "edit", "cancel"]);
const publicChanges = computed(() =>
  props.changes.filter((row) => row.key !== "vlr_url"),
);
const binding = computed(() =>
  props.changes.find((row) => row.key === "vlr_url"),
);
const chosen = computed(() =>
  props.changes.filter((row) => props.selected.includes(row.key)),
);
const projected = computed(() => ({
  ...props.player,
  ...Object.fromEntries(chosen.value.map((row) => [row.key, row.after])),
}));
const sourceFields = computed(() => {
  if (!props.profile) return [];
  return [
    ["real_name", props.profile.real_name],
    ["nationality", props.profile.nationality],
    ["team_id", props.profile.teams.join("、")],
  ].map(([key, external]) => ({
    key,
    external,
    change: publicChanges.value.find((row) => row.key === key),
  }));
});
const publishLabel = computed(() => {
  const count = chosen.value.filter((row) => row.key !== "vlr_url").length;
  if (!count)
    return chosen.value.length ? "仅保存 VLR 来源链接" : "请选择要保存的项目";
  return (
    "发布 " +
    count +
    " 项图鉴修改" +
    (props.selected.includes("vlr_url") ? "并保存来源链接" : "")
  );
});
function toggle(key, checked) {
  emit(
    "update:selected",
    checked
      ? [...props.selected, key]
      : props.selected.filter((item) => item !== key),
  );
}
</script>
<template>
  <section class="change-preview" :aria-label="player.ign + ' 的发布预览'">
    <h2>
      {{ player.ign }} ·
      {{
        publicChanges.length
          ? publicChanges.length + " 项图鉴资料可更新"
          : "图鉴资料没有待发布的变化"
      }}
    </h2>
    <p
      v-if="profile && binding && !publicChanges.length"
      class="binding-summary"
    >
      本次可绑定 VLR 来源链接，方便下次同步。选手图鉴会继续显示下方资料。
    </p>
    <p v-if="note" class="notice">{{ note }}</p>
    <div class="preview-grid">
      <div>
        <h3>{{ profile ? "逐项核对 VLR 资料" : "核对手动修改" }}</h3>
        <ul class="fields">
          <li
            v-for="field in profile
              ? sourceFields
              : publicChanges.map((change) => ({ key: change.key, change }))"
            :key="field.key"
          >
            <div class="field-heading">
              <strong>{{ labels[field.key] }}</strong>
              <label v-if="field.change"
                ><input
                  type="checkbox"
                  :checked="selected.includes(field.key)"
                  :disabled="busy"
                  :aria-label="'发布' + labels[field.key]"
                  @change="toggle(field.key, $event.target.checked)"
                />纳入发布</label
              >
              <span v-else>{{
                !field.external
                  ? "来源未提供"
                  : field.key === "team_id" && note
                    ? "待人工核对"
                    : "一致"
              }}</span>
            </div>
            <dl class="values">
              <div>
                <dt>本站当前</dt>
                <dd>{{ valueText(field.key, player[field.key]) }}</dd>
              </div>
              <div>
                <dt>{{ profile ? "VLR 资料" : "拟修改为" }}</dt>
                <dd>
                  {{
                    profile
                      ? field.external || "未列出"
                      : valueText(field.key, field.change.after)
                  }}
                </dd>
              </div>
            </dl>
          </li>
        </ul>
      </div>
      <div class="result" aria-live="polite">
        <h3>发布后的选手资料</h3>
        <div class="identity">
          <Portrait :player="projected" />
          <div>
            <strong>{{ projected.ign }}</strong>
            <p>{{ projected.real_name }}</p>
          </div>
        </div>
        <dl class="facts">
          <div
            v-for="key in ['team_id', 'nationality', 'player_role', 'status']"
            :key="key"
          >
            <dt>{{ labels[key] }}</dt>
            <dd :class="{ changed: selected.includes(key) }">
              {{ valueText(key, projected[key]) }}
            </dd>
          </div>
        </dl>
        <p class="bio">
          {{ projected.bio || "当前数据集中尚未收录详细介绍。" }}
        </p>
        <p v-if="selected.includes('team_id')" class="transfer">
          首页将新增转会动态：{{ player.ign }} ·
          {{ valueText("team_id", player.team_id) }} →
          {{ valueText("team_id", projected.team_id) }}
        </p>
      </div>
    </div>
    <div v-if="profile" class="source">
      <label v-if="binding"
        ><input
          type="checkbox"
          :checked="selected.includes('vlr_url')"
          :disabled="busy"
          @change="toggle('vlr_url', $event.target.checked)"
        />保存后台同步来源</label
      >
      <strong v-else>已绑定的同步来源</strong>
      <div v-if="binding">
        当前：{{ binding.before || "未绑定" }} ·
        {{ selected.includes("vlr_url") ? "将绑定" : "未选中" }}：<a
          :href="profile.url"
          target="_blank"
          rel="noopener noreferrer"
          >{{ profile.url }}</a
        >
      </div>
      <a v-else :href="profile.url" target="_blank" rel="noopener noreferrer">{{
        profile.url
      }}</a>
    </div>
    <div class="actions">
      <button
        v-if="changes.length"
        class="btn"
        :disabled="busy || !chosen.length"
        @click="emit('publish')"
      >
        {{ publishLabel }}
      </button>
      <button class="btn secondary" :disabled="busy" @click="emit('edit')">
        手动编辑资料
      </button>
      <button class="text-link" :disabled="busy" @click="emit('cancel')">
        取消预览
      </button>
    </div>
  </section>
</template>
<style scoped>
.change-preview {
  border-top: 1px solid var(--line);
  padding-top: 12px;
  scroll-margin: 1rem;
}
.change-preview h2 {
  font-size: 1.35rem;
  margin: 0.6rem 0;
}
.change-preview h3 {
  font-size: 1rem;
  margin: 0 0 0.8rem;
}
.binding-summary {
  margin: 0 0 1rem;
}
.preview-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 20px;
  align-items: start;
}
.fields {
  margin: 0;
  padding: 0;
  list-style: none;
}
.fields li,
.source {
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.field-heading,
.actions,
.identity {
  display: flex;
  align-items: center;
  gap: 12px;
}
.field-heading {
  justify-content: space-between;
}
.field-heading span {
  color: #46564d;
  font-size: 0.85rem;
}
.change-preview label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.values,
.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0.4rem 0 0;
}
dt {
  font-size: 0.82rem;
  color: #58645b;
}
dd {
  margin: 3px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.result {
  background: #f3f5ee;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 16px;
}
.identity .portrait {
  width: 60px;
  height: 64px;
  flex: none;
}
.identity strong {
  font-size: 1.4rem;
}
.identity p {
  margin: 2px 0;
}
.facts {
  margin-top: 12px;
}
.changed,
.transfer {
  color: #24573b;
  font-weight: 650;
}
.bio {
  white-space: pre-wrap;
  margin: 0.8rem 0 0;
  line-height: 1.55;
}
.source {
  margin-top: 12px;
  color: #48534a;
  overflow-wrap: anywhere;
}
.source a {
  text-decoration: underline;
}
.actions {
  flex-wrap: wrap;
  margin-top: 0.6rem;
}
.text-link {
  cursor: pointer;
}
@media (max-width: 760px) {
  .preview-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
}
</style>
