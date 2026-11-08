import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { supabase } from "../lib/supabase";

export const useMemberNews = defineStore("memberNews", () => {
  const follows = ref([]),
    messages = ref([]),
    unread = ref(0);
  const followReady = ref(false),
    followError = ref(""),
    inboxError = ref("");
  const pending = ref(new Set()),
    importing = ref(false),
    loading = ref(false);
  const pageStarts = ref([null]),
    hasOlder = ref(false);
  const favorites = computed(() =>
    follows.value.filter((f) => f.kind === "player").map((f) => f.target_id),
  );
  const teamFavorites = computed(() =>
    follows.value.filter((f) => f.kind === "team").map((f) => f.target_id),
  );
  let account = null,
    generation = 0,
    request = 0,
    followRequest = 0,
    channel,
    timer;

  async function refreshFollows() {
    if (!account) return;
    const seq = ++followRequest;
    const { data, error } = await supabase
      .from("atlas_follows")
      .select("kind,target_id")
      .eq("user_id", account);
    if (seq !== followRequest) return;
    if (error) {
      followError.value = "收藏暂时无法同步，请重试。";
      return;
    }
    follows.value = data;
    followReady.value = true;
    followError.value = "";
  }
  async function refreshInbox() {
    if (!account) return;
    const seq = ++request;
    let rows = supabase
      .from("atlas_inbox")
      .select("id,event,created_at,is_read")
      .eq("user_id", account)
      .order("id", { ascending: false })
      .limit(21);
    const before = pageStarts.value.at(-1);
    if (before) rows = rows.lt("id", before);
    loading.value = true;
    const [list, count] = await Promise.all([
      rows,
      supabase
        .from("atlas_inbox")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", account)
        .eq("is_read", false),
    ]);
    if (seq !== request) return;
    loading.value = false;
    if (list.error || count.error) {
      inboxError.value = "消息暂时无法同步，请重试。";
      return;
    }
    messages.value = list.data.slice(0, 20);
    hasOlder.value = list.data.length > 20;
    unread.value = count.count;
    inboxError.value = "";
  }
  function catchUp() {
    if (document.visibilityState === "visible" && account) {
      refreshInbox();
      refreshFollows();
    }
  }
  function connect(id) {
    generation++;
    request++;
    followRequest++;
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    clearInterval(timer);
    window.removeEventListener("online", catchUp);
    document.removeEventListener("visibilitychange", catchUp);
    account = id;
    follows.value = [];
    messages.value = [];
    unread.value = 0;
    loading.value = false;
    followReady.value = false;
    pending.value = new Set();
    importing.value = false;
    inboxError.value = "";
    followError.value = "";
    pageStarts.value = [null];
    hasOlder.value = false;
    if (!id) return;
    const current = generation;
    const changed = () => {
      if (current === generation) refreshInbox();
    };
    const filter = {
      schema: "public",
      table: "atlas_inbox",
      filter: "user_id=eq." + id,
    };
    channel = supabase
      .channel("inbox-" + id)
      .on("postgres_changes", { ...filter, event: "INSERT" }, changed)
      .on("postgres_changes", { ...filter, event: "UPDATE" }, changed)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") changed();
      });
    refreshInbox();
    refreshFollows();
    window.addEventListener("online", catchUp);
    document.addEventListener("visibilitychange", catchUp);
    timer = setInterval(catchUp, 60000);
  }
  async function toggle(id, kind = "player") {
    const key = kind + ":" + id;
    if (!account || pending.value.has(key)) return;
    const current = generation;
    if (!followReady.value) {
      await refreshFollows();
      if (
        current !== generation ||
        !followReady.value ||
        pending.value.has(key)
      )
        return;
    }
    const saved = follows.value.some(
      (row) => row.kind === kind && row.target_id === id,
    );
    pending.value.add(key);
    const table = supabase.from("atlas_follows");
    const row = { user_id: account, kind, target_id: id };
    const { error } = await (saved
      ? table.delete().match(row)
      : table.upsert(row, {
          onConflict: "user_id,kind,target_id",
          ignoreDuplicates: true,
        }));
    if (current !== generation) return;
    if (error) {
      pending.value.delete(key);
      followError.value = "收藏操作未完成，请重试。";
      return;
    }
    await refreshFollows();
    if (current === generation) pending.value.delete(key);
  }
  async function importLegacy(players, teams) {
    if (!account || importing.value) return false;
    const current = generation;
    const rows = [
      ...players.map((id) => ({ kind: "player", target_id: id })),
      ...teams.map((id) => ({ kind: "team", target_id: id })),
    ].map((r) => ({ ...r, user_id: account }));
    if (!rows.length) return true;
    importing.value = true;
    const { error } = await supabase
      .from("atlas_follows")
      .upsert(rows, {
        onConflict: "user_id,kind,target_id",
        ignoreDuplicates: true,
      });
    if (current !== generation) return false;
    importing.value = false;
    if (error) {
      followError.value = "旧收藏导入失败，请重试。";
      return false;
    }
    await refreshFollows();
    return current === generation;
  }
  async function markRead(id) {
    if (!account) return false;
    const current = generation;
    const { error } = await supabase
      .from("atlas_inbox")
      .update({ is_read: true })
      .eq("user_id", account)
      .eq("id", id);
    if (current !== generation) return false;
    if (error) {
      inboxError.value = "已读状态保存失败，请重试。";
      return false;
    }
    await refreshInbox();
    return current === generation;
  }
  function changePage(older) {
    if (older && hasOlder.value)
      pageStarts.value.push(messages.value.at(-1).id);
    else if (!older && pageStarts.value.length > 1) pageStarts.value.pop();
    else return;
    refreshInbox();
  }
  return {
    favorites,
    teamFavorites,
    connect,
    toggle,
    importLegacy,
    followReady,
    followError,
    pending,
    importing,
    refreshFollows,
    messages,
    unread,
    inboxError,
    refreshInbox,
    markRead,
    loading,
    pageStarts,
    hasOlder,
    changePage,
  };
});
