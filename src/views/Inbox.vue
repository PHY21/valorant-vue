<script setup>
import { onMounted } from "vue";
import { Bell } from "lucide-vue-next";
import { useMemberNews } from "../stores/memberNews";
import { useCatalog } from "../stores/catalog";
import PageHeading from "../components/PageHeading.vue";
const news = useMemberNews(),
  catalog = useCatalog();
onMounted(() => {
  news.pageStarts = [null];
  news.refreshInbox();
});
function destination(event) {
  return event.kind === "转会"
    ? "/detail/player/" + event.player_id
    : {
        path: "/compare/teams",
        query: { team: event.team_a, opponent: event.team_b },
      };
}
function openMessage(message) {
  if (!message.is_read) news.markRead(message.id);
  catalog.load();
}
</script>
<template>
  <PageHeading
    eyebrow="INBOX"
    title="我的消息"
    description="查看你收藏的选手转会和战队赛果。"
  />
  <section class="panel inbox-panel">
    <div class="inbox-head">
      <strong>{{ news.unread }} 条未读</strong
      ><RouterLink class="text-link" to="/favorites">管理我的收藏 ↗</RouterLink>
    </div>
    <p v-if="news.inboxError" class="notice" role="alert">
      {{ news.inboxError }}
      <button class="text-link" @click="news.refreshInbox()">重新加载</button>
    </p>
    <div v-if="news.messages.length">
      <article
        v-for="m in news.messages"
        :key="m.id"
        class="inbox-item"
        :class="{ unread: !m.is_read }"
      >
        <div class="inbox-meta">
          <b>{{ m.event.kind }}</b
          ><span v-if="!m.is_read" class="unread-label">未读</span
          ><time :datetime="m.created_at">{{
            new Date(m.created_at).toLocaleString("zh-CN", { hour12: false })
          }}</time>
        </div>
        <h2>
          <RouterLink :to="destination(m.event)" @click="openMessage(m)"
            >{{ m.event.title }} ↗</RouterLink
          >
        </h2>
        <p v-if="m.event.superseded_by" class="notice">
          这条比分记录已更正。最新比分为 {{ m.event.superseded_by }}。
        </p>
        <p v-if="m.event.detail">{{ m.event.detail }}</p>
        <button
          v-if="!m.is_read"
          class="text-link"
          @click="news.markRead(m.id)"
        >
          标为已读
        </button>
      </article>
    </div>
    <p v-else-if="news.loading" role="status">正在读取消息…</p>
    <div v-else-if="!news.inboxError" class="empty">
      <Bell :size="30" />
      <h2>暂无消息</h2>
      <p>管理员发布你关注的选手转会或战队赛果后，消息会出现在这里。</p>
    </div>
    <div v-if="news.pageStarts.length > 1 || news.hasOlder" class="pages">
      <button
        class="btn secondary"
        :disabled="news.loading || news.pageStarts.length === 1"
        @click="news.changePage(false)"
      >
        较新消息</button
      ><button
        class="btn secondary"
        :disabled="news.loading || !news.hasOlder"
        @click="news.changePage(true)"
      >
        较早消息
      </button>
    </div>
  </section>
</template>
<style scoped>
.inbox-panel {
  padding: clamp(16px, 3vw, 30px);
}
.inbox-head,
.inbox-meta,
.pages {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.inbox-head {
  justify-content: space-between;
  padding-bottom: 14px;
}
.inbox-item {
  padding: 16px 12px;
  border-top: 1px solid var(--line);
  overflow-wrap: anywhere;
}
.inbox-item.unread {
  background: #f8f8f3;
}
.inbox-item h2 {
  font-size: 1.15rem;
  margin: 8px 0;
}
.inbox-meta {
  font-size: 0.82rem;
  color: #59665d;
}
.unread-label {
  color: #ac3029;
}
.pages {
  margin-top: 14px;
}
</style>
