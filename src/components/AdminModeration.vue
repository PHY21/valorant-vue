<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabase";
import { adminError } from "../lib/admin";
import { useCatalog } from "../stores/catalog";
const catalog = useCatalog(),
  rows = ref([]),
  page = ref(0),
  more = ref(false),
  busy = ref(false),
  target = ref(null),
  reason = ref(""),
  message = ref("");
function subject(key) {
  const [k, id] = key.split(":");
  const cfg = {
    team: ["team_id", "team_name"],
    player: ["player_id", "ign"],
    tournament: ["tournament_id", "tournament_name"],
  }[k];
  return cfg
    ? catalog.data[k]?.find((r) => r[cfg[0]] === Number(id))?.[cfg[1]] || key
    : key;
}
async function load(n = 0) {
  busy.value = true;
  message.value = "";
  target.value = null;
  try {
    const { data, error } = await supabase
      .from("atlas_comments")
      .select("id,body,target,created_at,atlas_profiles(display_name)")
      .order("created_at", { ascending: false })
      .order("id")
      .range(n * 20, n * 20 + 20);
    if (error) throw error;
    rows.value = data.slice(0, 20);
    more.value = data.length > 20;
    page.value = n;
  } catch (e) {
    message.value = adminError(e);
  } finally {
    busy.value = false;
  }
}
onMounted(() => load());
async function remove() {
  if (busy.value || !target.value || !reason.value.trim()) return;
  busy.value = true;
  try {
    const { error } = await supabase.rpc("atlas_remove_comment", {
      comment_id: target.value.id,
      reason: reason.value.trim(),
    });
    if (error) throw error;
    await load(
      rows.value.length === 1 && page.value > 0 ? page.value - 1 : page.value,
    );
    if (!message.value) message.value = "该评论已删除，处理原因已记入后台。";
  } catch (e) {
    message.value = adminError(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="panel ops">
    <h2>评论管理</h2>
    <p class="caption">
      按发表时间从新到旧显示全站公开评论。删除前请核对原文，并留下处理原因。
    </p>
    <p v-if="message" class="notice" role="status">{{ message }}</p>
    <p v-if="!rows.length && !message">
      {{ busy ? "正在加载…" : "暂无公开评论。" }}
    </p>
    <article v-for="c in rows" :key="c.id" class="ops-row">
      <b>{{ c.atlas_profiles?.display_name || "会员" }}</b> ·
      <RouterLink :to="'/detail/' + c.target.replace(':', '/')">{{
        subject(c.target)
      }}</RouterLink
      ><small>{{ new Date(c.created_at).toLocaleString("zh-CN") }}</small>
      <p>{{ c.body }}</p>
      <button
        v-if="target?.id !== c.id"
        class="btn secondary"
        :disabled="busy"
        @click="
          target = c;
          reason = '';
          message = '';
        "
      >
        处理这条评论
      </button>
      <form v-else @submit.prevent="remove">
        <label
          >删除原因<input
            required
            maxlength="200"
            v-model.trim="reason"
            placeholder="例如：包含人身攻击" /></label
        ><button class="btn" :disabled="busy || !reason">确认删除</button>
        <button
          type="button"
          class="btn secondary"
          :disabled="busy"
          @click="target = null"
        >
          取消
        </button>
      </form>
    </article>
    <div class="admin-actions">
      <button
        class="btn secondary"
        :disabled="busy || !page"
        @click="load(page - 1)"
      >
        上一页
      </button>
      第 {{ page + 1 }} 页
      <button
        class="btn secondary"
        :disabled="busy || !more"
        @click="load(page + 1)"
      >
        下一页
      </button>
      <button class="btn secondary" :disabled="busy" @click="load(page)">
        刷新
      </button>
    </div>
  </section>
</template>
