<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { Trash2 } from "lucide-vue-next";
import { useAuth } from "../stores/auth.js";
import { useCatalog } from "../stores/catalog.js";
import { supabase } from "../lib/supabase.js";
const props = defineProps({ target: { type: String, required: true } });
const auth = useAuth(),
  catalog = useCatalog(),
  route = useRoute();
const comments = ref([]),
  text = ref(""),
  rating = ref(5),
  loading = ref(false),
  busy = ref(false),
  error = ref(""),
  message = ref("");
const legacy = computed(() =>
  catalog.comments.filter((c) => c.target === props.target),
);
let active = true;
onUnmounted(() => {
  active = false;
});
async function load() {
  if (!supabase) return;
  loading.value = true;
  error.value = "";
  try {
    const { data, error: failure } = await supabase
      .from("atlas_comments")
      .select(
        "id,author_id,body,rating,created_at,atlas_profiles(display_name)",
      )
      .eq("target", props.target)
      .order("created_at", { ascending: false })
      .limit(50);
    if (failure) throw failure;
    if (active) comments.value = data;
  } catch {
    if (active) error.value = "公开评价暂时无法加载，请稍后重试。";
  } finally {
    if (active) loading.value = false;
  }
}
onMounted(load);
async function submit() {
  if (busy.value || !auth.user || !supabase) return;
  if (!text.value.trim()) {
    error.value = "请填写评价内容。";
    return;
  }
  const author = auth.user.id;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    const { error: failure } = await supabase.from("atlas_comments").insert({
      author_id: author,
      target: props.target,
      body: text.value.trim(),
      rating: Number(rating.value),
    });
    if (failure) throw failure;
    if (active && auth.user?.id === author) {
      text.value = "";
      message.value = "评价已公开发布。";
      await load();
    }
  } catch {
    if (active) error.value = "发表失败，请确认登录状态和网络后重试。";
  } finally {
    if (active) busy.value = false;
  }
}
async function remove(comment) {
  if (busy.value || comment.author_id !== auth.user?.id) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    const { data, error: failure } = await supabase
      .from("atlas_comments")
      .delete()
      .eq("id", comment.id)
      .eq("author_id", auth.user.id)
      .select("id");
    if (failure || !data?.length) throw failure || new Error("not deleted");
    if (active) {
      comments.value = comments.value.filter((c) => c.id !== comment.id);
      message.value = "已删除你的评价。";
    }
  } catch {
    if (active) error.value = "删除失败，请确认登录状态后重试。";
  } finally {
    if (active) busy.value = false;
  }
}
</script>
<template>
  <section class="panel comments-panel">
    <span class="eyebrow">YOUR TAKE</span>
    <h2>留下你的看法</h2>
    <p class="method-note">
      评价对已登录用户可见，以账号昵称发表。请友善交流，不要填写私人联系方式。
    </p>
    <p v-if="!auth.configured" class="notice">在线评价服务正在准备中。</p>
    <p v-else-if="!auth.ready" role="status">正在恢复登录状态…</p>
    <form v-else-if="auth.user" @submit.prevent="submit" :aria-busy="busy">
      <div class="form-row">
        <p>
          以 <strong>{{ auth.displayName }}</strong> 的身份发表
        </p>
        <label
          >评分<select v-model="rating" :disabled="busy">
            <option v-for="n in 5" :key="n" :value="n">
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
          :disabled="busy"
          placeholder="聊聊你欣赏的表现…"
        ></textarea>
      </label>
      <div class="comment-submit">
        <span class="caption">{{ text.length }} / 500</span
        ><button class="btn" type="submit" :disabled="busy">
          {{ busy ? "正在处理…" : "公开发表评价 ↗" }}
        </button>
      </div>
    </form>
    <p v-else class="notice">
      <RouterLink
        class="text-link"
        :to="{ path: '/login', query: { returnTo: route.fullPath } }"
        >登录</RouterLink
      >
      或
      <RouterLink
        class="text-link"
        :to="{ path: '/register', query: { returnTo: route.fullPath } }"
        >注册账号</RouterLink
      >
      后发表评价。
    </p>
    <p v-if="error" role="alert" class="form-error">
      {{ error }}
      <button class="text-link" :disabled="loading || busy" @click="load">
        重试加载
      </button>
    </p>
    <p v-if="message" role="status" class="notice">{{ message }}</p>
    <p v-if="loading" role="status" class="caption">正在加载公开评价…</p>
    <div v-for="c in comments" :key="c.id" class="comment">
      <div>
        <strong>{{ c.atlas_profiles?.display_name || "图鉴访客" }}</strong
        ><span class="rating-stars">{{ "★".repeat(c.rating) }}</span
        ><span class="caption">{{
          new Date(c.created_at).toLocaleDateString("zh-CN")
        }}</span
        ><button
          v-if="c.author_id === auth.user?.id"
          class="icon-btn"
          aria-label="删除我的评价"
          :disabled="busy"
          @click="remove(c)"
        >
          <Trash2 :size="15" />
        </button>
      </div>
      <p>{{ c.body }}</p>
    </div>
    <p
      v-if="auth.configured && !loading && !error && !comments.length"
      class="caption"
    >
      还没有公开评价，来分享第一条看法吧。
    </p>
    <p v-if="comments.length === 50" class="caption">
      显示最新 50 条公开评价。
    </p>
    <details v-if="legacy.length" class="legacy-comments">
      <summary>
        查看此浏览器的旧评价（{{ legacy.length }} 条，仅自己可见）
      </summary>
      <p class="caption">
        这些是升级前的本地记录，没有上传到服务器，也没有绑定账号。
      </p>
      <div v-for="c in legacy" :key="c.id" class="comment">
        <div>
          <strong>{{ c.name }}</strong
          ><span class="caption">本地历史</span
          ><button
            class="icon-btn"
            :aria-label="'删除 ' + c.name + ' 的本地评价'"
            @click="catalog.removeComment(c.id)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
        <p>{{ c.text }}</p>
      </div>
    </details>
  </section>
</template>
