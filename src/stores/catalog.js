import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { readSaved } from "../lib/storage";
import { useMemberNews } from "./memberNews";
import { supabase } from "../lib/supabase.js";
export const useCatalog = defineStore("catalog", () => {
  const data = ref(null),
    loading = ref(false),
    error = ref(""),
    storageError = ref("");
  let saved;
  try {
    saved = readSaved(localStorage.getItem("atlas-v1"));
  } catch {
    saved = readSaved(null);
  }
  const news = useMemberNews();
  const legacyPlayers = ref(saved.favorites),
    legacyTeams = ref(saved.teamFavorites),
    comments = ref(saved.comments);
  watch(
    [legacyPlayers, legacyTeams, comments],
    () => {
      try {
        localStorage.setItem(
          "atlas-v1",
          JSON.stringify({
            favorites: legacyPlayers.value,
            teamFavorites: legacyTeams.value,
            comments: comments.value,
          }),
        );
        storageError.value = "";
      } catch {
        storageError.value = "浏览器未允许保存，本次操作仅在当前页面有效。";
      }
    },
    { deep: true },
  );
  let generation = 0;
  function clearData() {
    generation++;
    data.value = null;
    loading.value = false;
    error.value = "";
  }
  async function load() {
    const current = ++generation;
    loading.value = true;
    error.value = "";
    try {
      if (!supabase) throw Error();
      const { data: row, error: failure } = await supabase
        .from("atlas_catalog")
        .select("content")
        .eq("id", 1)
        .single();
      if (failure || !row) throw Error();
      if (current === generation) data.value = row.content;
    } catch {
      if (current === generation)
        error.value = "数据暂时无法加载，请检查登录状态和网络后重试。";
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  const players = computed(
    () =>
      data.value?.player.map((p) => {
        const t = data.value.team.find((t) => t.team_id === p.team_id);
        const r = data.value.region.find((r) => r.region_id === t?.region_id);
        return {
          ...p,
          team_tag: t?.team_tag || "自由选手",
          region_code: r?.region_code || "其他",
        };
      }) || [],
  );
  async function importFavorites() {
    if (await news.importLegacy(legacyPlayers.value, legacyTeams.value)) {
      legacyPlayers.value = [];
      legacyTeams.value = [];
    }
  }
  function addComment(c) {
    comments.value.unshift({
      ...c,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    });
  }
  function removeComment(id) {
    comments.value = comments.value.filter((c) => c.id !== id);
  }
  return {
    data,
    players,
    loading,
    error,
    load,
    clearData,
    favorites: computed(() => news.favorites),
    teamFavorites: computed(() => news.teamFavorites),
    legacyPlayers,
    legacyTeams,
    importFavorites,
    comments,
    toggle: news.toggle,
    addComment,
    removeComment,
    storageError,
  };
});
