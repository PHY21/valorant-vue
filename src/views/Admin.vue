<script setup>
import { computed, ref, watch, nextTick, onMounted } from "vue";
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
import AdminMatch from "../components/AdminMatch.vue";
import AdminModeration from "../components/AdminModeration.vue";
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
const candidates = ref([]),
  fetched = ref(null),
  reviewEl = ref(null),
  owner = ref(false),
  pendingRole = ref(null),
  operations = ref([]);
onMounted(async () => {
  const { data } = await supabase.rpc("atlas_is_owner");
  owner.value = data === true;
});
const liveChanges = computed(() =>
  base.value ? differences(base.value, draft.value) : [],
);
async function showReview() {
  await nextTick();
  reviewEl.value?.scrollIntoView({ behavior: "smooth", block: "center" });
}
const directoryStatus = {
  verified: "邮箱已验证",
  pending: "待验证邮箱",
  legacy: "旧账号或匿名账号",
  blocked: "登录受限",
};
function resetEditor() {
  const p = entries.value.find((row) => row.player_id === selected.value);
  if (!p) return;
  candidates.value = [];
  fetched.value = null;
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
  showReview();
  message.value = changes.length ? "" : "资料一致，没有需要发布的修改。";
}
async function sync(input = url.value) {
  fetched.value = null;
  review.value = [];
  accepted.value = [];
  busy.value = true;
  message.value = "";
  note.value = "";
  try {
    const { data, error } = await supabase.functions.invoke(
      "atlas-vlr-preview",
      { body: { url: input.trim() } },
    );
    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      throw Error(
        detail?.error || "暂时无法读取 VLR，请检查资料页地址或稍后再试。",
      );
    }
    if (Array.isArray(data.candidates)) {
      candidates.value = data.candidates;
      message.value = candidates.value.length
        ? "找到 " +
          candidates.value.length +
          " 个候选人。请核对编号或打开原页，再选择要预览的人。"
        : "搜索结果中没有选手。请换一个比赛 ID，或粘贴选手资料页。";
      return;
    }
    if (base.value.ign.toLowerCase() !== data.ign.toLowerCase()) {
      const matches = entries.value.filter(
        (p) => p.ign.toLowerCase() === data.ign.toLowerCase(),
      );
      if (matches.length !== 1)
        throw Error(
          "VLR 返回了 " +
            data.ign +
            "，本站没有唯一对应的选手。请核对来源和选手。",
        );
      const choices = candidates.value;
      selected.value = matches[0].player_id;
      await nextTick();
      candidates.value = choices;
    }
    const { values, note: warning } = sourceProposal(
      base.value,
      data,
      catalog.data.team,
    );
    fetched.value = data;
    url.value = data.url;
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
  pendingRole.value = null;
  if (!["users", "history"].includes(name)) return;
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
      const ops = await supabase.rpc("atlas_operation_history");
      if (ops.error) throw ops.error;
      operations.value = ops.data;
    }
  } catch (err) {
    message.value = adminError(err);
  } finally {
    busy.value = false;
  }
}
async function setRole() {
  const u = pendingRole.value;
  if (!u || busy.value) return;
  busy.value = true;
  try {
    const { error } = await supabase.rpc("atlas_set_editor", {
      target_id: u.id,
      enabled: u.role !== "admin",
    });
    if (error) throw error;
    busy.value = false;
    await openTab("users", page.value);
    if (!message.value)
      message.value =
        u.role === "admin"
          ? "已撤销管理权限。"
          : "已授予管理权限，对方刷新网站后即可进入后台。";
  } catch (e) {
    message.value = adminError(e);
  } finally {
    busy.value = false;
    pendingRole.value = null;
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
    description="发布比赛和转会动态，核对选手资料，处理社区评论。"
  />
  <div class="admin-tabs" aria-label="管理栏目">
    <button
      v-for="[key, title] in [
        ['players', '选手与转会'],
        ['matches', '录入赛果'],
        ['comments', '评论管理'],
        ...(owner ? [['users', '用户与权限']] : []),
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
        >VLR 搜索页或选手资料页<input
          v-model="url"
          type="text"
          @input="
            candidates = [];
            fetched = null;
          "
          placeholder="https://www.vlr.gg/player/编号/选手名"
      /></label>
      <div class="admin-actions">
        <button
          class="btn"
          :disabled="!url.trim()"
          @click="
            candidates = [];
            sync();
          "
        >
          拉取并预览
        </button>
        <a
          :href="'https://www.vlr.gg/search/?q=' + encodeURIComponent(base.ign)"
          target="_blank"
          rel="noopener noreferrer"
          >在 VLR 查找 {{ base.ign }} ↗</a
        >
      </div>
      <div v-if="candidates.length" class="candidate-list">
        <div v-for="c in candidates" :key="c.id">
          <b>{{ c.ign }}</b> · VLR #{{ c.id }}
          <a :href="c.url" target="_blank" rel="noopener noreferrer"
            >查看资料 ↗</a
          >
          <button class="btn secondary" @click="sync(c.url)">预览此人</button>
        </div>
      </div>
      <details>
        <summary>手动编辑 / 登记转会</summary>
        <form
          @submit.prevent="
            note = '';
            fetched = null;
            preview(draft);
          "
        >
          <div class="admin-grid">
            <label v-for="k in ['real_name', 'nationality']" :key="k"
              >{{ labels[k]
              }}<input v-model.trim="draft[k]" required maxlength="120"
            /></label>
            <label
              >所属战队<select aria-label="所属战队" v-model="draft.team_id">
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
          <div v-if="liveChanges.length" aria-live="polite">
            <h3>
              你正在修改 {{ base.ign }} 的 {{ liveChanges.length }} 项资料
            </h3>
            <p v-for="c in liveChanges" :key="c.key">
              {{ labels[c.key] }}：{{ valueText(c.key, c.before) }} →
              <b>{{ valueText(c.key, c.after) }}</b>
            </p>
          </div>
          <p class="caption">更改所属战队并发布后，首页会同时出现转会动态。</p>
          <button class="btn secondary" :disabled="!liveChanges.length">
            预览手动修改
          </button>
        </form>
      </details>
    </fieldset>
    <div ref="reviewEl" aria-live="polite">
      <p v-if="fetched" class="notice">
        <b>已读取 {{ fetched.ign }}</b> ·
        {{ fetched.real_name || "未列姓名" }} ·
        {{ fetched.nationality || "未列地区" }} ·
        {{ fetched.teams.join("、") || "未列战队" }}。{{
          review.length
            ? "下方列出与本站不同的字段。"
            : "与本站可核对的字段一致。"
        }}
      </p>
      <p v-if="note" class="notice">{{ note }}</p>
      <div v-if="review.length" class="admin-review">
        <h2>{{ base.ign }} · 共 {{ review.length }} 项差异</h2>
        <a
          v-if="source"
          :href="source"
          target="_blank"
          rel="noopener noreferrer"
          >核对 VLR 原始资料 ↗</a
        >
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>发布字段</th>
                <th>修改前（本站）</th>
                <th>修改后（待发布）</th>
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
              fetched = null;
              message = '';
              note = '';
            "
          >
            取消预览
          </button>
        </div>
      </div>
    </div>
  </section>
  <AdminMatch v-else-if="tab === 'matches'" />
  <AdminModeration v-else-if="tab === 'comments'" />
  <section v-else-if="tab === 'users'" class="panel admin-panel">
    <h2>用户与权限</h2>
    <p>
      已验证会员可以浏览图鉴、收藏和管理自己的评价。管理员可维护赛果、选手和评论；只有站长可以任免管理员。
    </p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>昵称 / 邮箱</th>
            <th>角色</th>
            <th>账号状态</th>
            <th>最近登录</th>
            <th>授权</th>
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
                  ? "站长"
                  : u.role === "admin"
                    ? "管理员"
                    : u.status === "verified"
                      ? "会员"
                      : "普通账号"
              }}
            </td>
            <td>{{ directoryStatus[u.status] }}</td>
            <td>{{ date(u.last_sign_in_at) }}</td>
            <td>
              <button
                v-if="
                  u.role !== 'owner' &&
                  (u.status === 'verified' || u.role === 'admin')
                "
                class="btn secondary"
                :disabled="busy"
                @click="pendingRole = u"
              >
                {{ u.role === "admin" ? "撤销管理权限" : "设为管理员" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="pendingRole" class="notice" role="group">
      <p>
        确认{{ pendingRole.role === "admin" ? "撤销" : "授予" }}
        {{ pendingRole.display_name }}（{{ pendingRole.email_hint }} ·
        {{ pendingRole.id.slice(0, 8) }}）的管理员权限？
      </p>
      <button class="btn" :disabled="busy" @click="setRole">
        确认{{ pendingRole.role === "admin" ? "撤销" : "授权" }}
      </button>
      <button
        class="btn secondary"
        :disabled="busy"
        @click="pendingRole = null"
      >
        取消
      </button>
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
    <h2>比赛、授权与评论处理记录</h2>
    <p v-if="!operations.length">暂无记录。</p>
    <p v-for="o in operations" :key="o.id">
      <b>{{ o.action }}</b> · {{ o.detail }}
      <small>{{ date(o.created_at) }} · {{ o.actor_name }}</small>
    </p>
    <h2>最近 50 次选手资料发布</h2>
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
.candidate-list > div {
  padding: 10px 0;
  border-top: 1px solid var(--line);
}
.candidate-list a {
  margin: 0 10px;
}
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
