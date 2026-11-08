<script setup>
import { computed, ref, watch } from "vue";
import { supabase } from "../lib/supabase";
import {
  adminError,
  differences,
  labels,
  roles,
  sourceProposal,
  statuses,
} from "../lib/admin";
import { useCatalog } from "../stores/catalog";
import PageHeading from "../components/PageHeading.vue";
const catalog = useCatalog();
const tab = ref("players"),
  search = ref(""),
  selected = ref(
    catalog.players.find((p) => p.ign === "ZmjjKK")?.player_id ??
      catalog.players[0]?.player_id,
  );
const entries = computed(() => catalog.data?.player || []);
const options = computed(() =>
  entries.value.filter(
    (p) =>
      p.player_id === selected.value ||
      (p.ign + " " + p.real_name)
        .toLowerCase()
        .includes(search.value.trim().toLowerCase()),
  ),
);
const base = ref(null),
  draft = ref({}),
  url = ref(""),
  review = ref([]),
  accepted = ref([]),
  source = ref(null),
  busy = ref(false),
  message = ref(""),
  note = ref("");
const users = ref([]),
  page = ref(0),
  total = ref(0),
  history = ref([]);
const directoryStatus = {
  verified: "邮箱已验证",
  pending: "待验证邮箱",
  legacy: "旧账号或匿名账号",
  blocked: "登录受限",
};
function resetEditor() {
  const p = entries.value.find((row) => row.player_id === selected.value);
  if (!p) return;
  base.value = { ...p };
  draft.value = Object.fromEntries(
    Object.keys(labels)
      .filter((k) => k !== "vlr_url")
      .map((k) => [k, p[k] ?? null]),
  );
  url.value =
    p.vlr_url ||
    (p.ign === "ZmjjKK" ? "https://www.vlr.gg/player/3520/zmjjkk" : "");
  review.value = [];
  accepted.value = [];
  source.value = null;
  message.value = "";
  note.value = "";
}
watch(selected, resetEditor, { immediate: true });
function valueText(key, val) {
  if (key === "team_id")
    return (
      catalog.data?.team.find((t) => t.team_id === val)?.team_name ||
      (val == null ? "无所属战队" : "未知战队")
    );
  return val ?? "未设置";
}
function preview(values, from = null) {
  const changes = differences(base.value, values);
  review.value = changes;
  accepted.value = changes.map((c) => c.key);
  source.value = from;
  message.value = changes.length ? "" : "资料一致，没有需要发布的修改。";
}
async function sync() {
  busy.value = true;
  message.value = "";
  note.value = "";
  try {
    const { data, error } = await supabase.functions.invoke(
      "atlas-vlr-preview",
      { body: { url: url.value.trim() } },
    );
    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      throw Error(
        detail?.error || "暂时无法读取 VLR，请检查资料页地址或稍后再试。",
      );
    }
    const { values, note: warning } = sourceProposal(
      base.value,
      data,
      catalog.data.team,
    );
    note.value = warning;
    preview(values, data.url);
  } catch (err) {
    message.value = err.message;
  } finally {
    busy.value = false;
  }
}
async function publish() {
  if (busy.value || !accepted.value.length) return;
  const rows = review.value.filter((c) => accepted.value.includes(c.key));
  const fields = (k) => Object.fromEntries(rows.map((c) => [c.key, c[k]]));
  busy.value = true;
  message.value = "";
  try {
    const { error } = await supabase.rpc("atlas_publish_player", {
      pid: selected.value,
      expected: fields("before"),
      changes: fields("after"),
      source_url: source.value,
    });
    if (error) throw error;
    await catalog.load();
    resetEditor();
    review.value = [];
    accepted.value = [];
    message.value = catalog.error
      ? "已发布，但重新读取资料失败。请刷新页面。"
      : "已发布，选手图鉴已更新。";
  } catch (err) {
    message.value = adminError(err);
  } finally {
    busy.value = false;
  }
}
async function openTab(name, num = 0) {
  if (busy.value) return;
  tab.value = name;
  message.value = "";
  note.value = "";
  if (name === "players") return;
  busy.value = true;
  try {
    if (name === "users") {
      users.value = [];
      const { data, error } = await supabase.rpc("atlas_admin_users", {
        page_no: num,
      });
      if (error) throw error;
      users.value = data.rows;
      total.value = data.total;
      page.value = num;
    } else {
      history.value = [];
      const { data, error } = await supabase.rpc("atlas_admin_history");
      if (error) throw error;
      history.value = data;
    }
  } catch (err) {
    message.value = adminError(err);
  } finally {
    busy.value = false;
  }
}
function date(value) {
  return value
    ? new Date(value).toLocaleString("zh-CN", { hour12: false })
    : "尚无记录";
}
</script>
<template>
  <PageHeading
    eyebrow="SITE ADMIN"
    title="网站管理"
    description="审核选手资料、查看用户权限和发布记录。"
  />
  <div class="admin-tabs" aria-label="管理栏目">
    <button
      v-for="[key, title] in [
        ['players', '选手资料'],
        ['users', '用户与权限'],
        ['history', '修改记录'],
      ]"
      :key="key"
      class="btn"
      :class="{ secondary: tab !== key }"
      :disabled="busy"
      :aria-pressed="tab === key"
      @click="openTab(key)"
    >
      {{ title }}
    </button>
  </div>
  <p v-if="message" class="notice" role="status">{{ message }}</p>
  <section v-if="tab === 'players' && base" class="panel admin-panel">
    <fieldset :disabled="busy || review.length > 0">
      <legend>选择选手</legend>
      <div class="admin-grid">
        <label
          >搜索选手<input v-model="search" placeholder="比赛 ID 或姓名"
        /></label>
        <label
          >选手<select v-model="selected">
            <option
              v-for="p in options"
              :key="p.player_id"
              :value="p.player_id"
            >
              {{ p.ign }} · {{ p.real_name }}
            </option>
          </select></label
        >
      </div>
      <h2>从 VLR 同步</h2>
      <label
        >选手资料页<input
          v-model="url"
          type="url"
          placeholder="https://www.vlr.gg/player/编号/选手名"
      /></label>
      <div class="admin-actions">
        <button class="btn" :disabled="!url.trim()" @click="sync">
          拉取并预览
        </button>
        <a
          :href="'https://www.vlr.gg/search/?q=' + encodeURIComponent(base.ign)"
          target="_blank"
          rel="noopener noreferrer"
          >在 VLR 查找 {{ base.ign }} ↗</a
        >
      </div>
      <details>
        <summary>手动编辑选手资料</summary>
        <form
          @submit.prevent="
            note = '';
            preview(draft);
          "
        >
          <div class="admin-grid">
            <label v-for="k in ['real_name', 'nationality']" :key="k"
              >{{ labels[k]
              }}<input v-model.trim="draft[k]" required maxlength="120"
            /></label>
            <label
              >所属战队<select v-model="draft.team_id">
                <option :value="null">无所属战队</option>
                <option
                  v-for="t in catalog.data.team"
                  :key="t.team_id"
                  :value="t.team_id"
                >
                  {{ t.team_name }}
                </option>
              </select></label
            >
            <label
              >定位<select v-model="draft.player_role">
                <option v-for="v in roles" :key="v">{{ v }}</option>
              </select></label
            >
            <label
              >状态<select v-model="draft.status">
                <option v-for="v in statuses" :key="v">{{ v }}</option>
              </select></label
            >
          </div>
          <label
            >简介<textarea
              v-model.trim="draft.bio"
              rows="4"
              maxlength="4000"
            ></textarea>
          </label>
          <button class="btn secondary">预览手动修改</button>
        </form>
      </details>
    </fieldset>
    <p v-if="note" class="notice">{{ note }}</p>
    <div v-if="review.length" class="admin-review">
      <h2>审核 {{ base.ign }} 的修改</h2>
      <a v-if="source" :href="source" target="_blank" rel="noopener noreferrer"
        >核对 VLR 原始资料 ↗</a
      >
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>发布字段</th>
              <th>当前值</th>
              <th>候选值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in review" :key="c.key">
              <th>
                <label class="check-field"
                  ><input
                    type="checkbox"
                    v-model="accepted"
                    :disabled="busy"
                    :value="c.key"
                  />{{ labels[c.key] }}</label
                >
              </th>
              <td>{{ valueText(c.key, c.before) }}</td>
              <td>{{ valueText(c.key, c.after) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="admin-actions">
        <button
          class="btn"
          :disabled="busy || !accepted.length"
          @click="publish"
        >
          发布选中的 {{ accepted.length }} 项修改
        </button>
        <button
          class="btn secondary"
          :disabled="busy"
          @click="
            review = [];
            message = '';
            note = '';
          "
        >
          取消预览
        </button>
      </div>
    </div>
  </section>
  <section v-else-if="tab === 'users'" class="panel admin-panel">
    <h2>用户与权限</h2>
    <p>
      已验证会员可以浏览图鉴、收藏和管理自己的评价。管理员还可以发布选手资料、查看账号状态与修改记录。
    </p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>昵称 / 邮箱</th>
            <th>角色</th>
            <th>账号状态</th>
            <th>最近登录</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>
              {{ u.display_name }}<small>{{ u.email_hint }}</small>
            </td>
            <td>
              {{
                u.role === "owner"
                  ? "管理员"
                  : u.status === "verified"
                    ? "会员"
                    : "普通账号"
              }}
            </td>
            <td>{{ directoryStatus[u.status] }}</td>
            <td>{{ date(u.last_sign_in_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="admin-actions">
      <button
        class="btn secondary"
        :disabled="busy || !page"
        @click="openTab('users', page - 1)"
      >
        上一页</button
      ><span>共 {{ total }} 个账号 · 第 {{ page + 1 }} 页</span
      ><button
        class="btn secondary"
        :disabled="busy || (page + 1) * 25 >= total"
        @click="openTab('users', page + 1)"
      >
        下一页
      </button>
    </div>
  </section>
  <section v-else-if="tab === 'history'" class="panel admin-panel">
    <h2>最近 50 次发布</h2>
    <p v-if="!busy && !history.length && !message">还没有发布记录。</p>
    <details v-for="log in history" :key="log.id">
      <summary>
        {{ log.player_name }} · {{ date(log.created_at) }} ·
        {{ log.source_url ? "VLR 同步" : "手动编辑" }}
      </summary>
      <p v-for="(v, k) in log.published" :key="k">
        <strong>{{ labels[k] }}</strong
        >：{{ valueText(k, log.previous[k]) }} → {{ valueText(k, v) }}
      </p>
      <a
        v-if="log.source_url"
        :href="log.source_url"
        target="_blank"
        rel="noopener noreferrer"
        >来源资料页 ↗</a
      >
    </details>
  </section>
  <p v-if="busy" role="status">正在处理，请稍候…</p>
</template>
<style scoped>
.admin-tabs,
.admin-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}
.admin-panel {
  padding: clamp(16px, 3vw, 32px);
  overflow-wrap: anywhere;
}
.admin-panel fieldset {
  border: 0;
  min-width: 0;
  padding: 0;
}
.admin-panel h2,
.admin-panel legend {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 14px 0;
}
.admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(225px, 100%), 1fr));
  gap: 12px;
}
.admin-panel label {
  display: grid;
  gap: 5px;
  margin: 7px 0;
}
.admin-panel input:not([type="checkbox"]),
.admin-panel select,
.admin-panel textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: white;
  padding: 10px;
  font: inherit;
  color: inherit;
}
.admin-panel details {
  border-top: 1px solid var(--line);
  padding: 14px 0;
}
.admin-panel summary,
.admin-panel button {
  cursor: pointer;
}
.admin-panel small {
  display: block;
  color: var(--muted);
}
.admin-panel .check-field {
  display: flex;
  align-items: center;
  gap: 7px;
}
.admin-panel td {
  white-space: normal;
  min-width: 95px;
}
.admin-panel a {
  text-decoration: underline;
}
.admin-review {
  border-top: 1px solid var(--line);
  margin-top: 16px;
}
</style>
