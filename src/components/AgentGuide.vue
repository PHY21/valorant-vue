<script setup>
import { computed, ref } from "vue";
import { Play } from "lucide-vue-next";
import GuideVideo from "./GuideVideo.vue";
import chapters from "../assets/agent-intros/chapters.json";
const props = defineProps({ agent: { type: Object, required: true } });
const base = import.meta.env.BASE_URL;
const selectedClip = ref(null);
const showIntro = ref(false);
const films = import.meta.glob("../assets/agent-intros/*.mp4", { eager: true, query: "?url", import: "default" });
const slug = computed(() => props.agent.agent_name.toLowerCase().replace("/", "-"));
const film = computed(() => films[`../assets/agent-intros/${slug.value}.mp4`]);
const original = computed(() => {
  const url = props.agent.video_url || "";
  return /^https:\/\/www\.(?:bilibili\.com\/video\/BV[a-zA-Z0-9]+\/?|youtube\.com\/watch\?v=[\w-]{11})$/.test(url) ? url : null;
});
function chapterUrl(ability) {
  const start = chapters[slug.value]?.[ability.english];
  if (!film.value || start === undefined) return undefined;
  const next = Object.values(chapters[slug.value]).find(time => time > start);
  return `${film.value}#t=${start}${next === undefined ? "" : "," + next}`;
}
function openSkill(ability) {
  showIntro.value = false;
  selectedClip.value = selectedClip.value === ability.english ? null : ability.english;
}
function openIntro() {
  selectedClip.value = null;
  showIntro.value = true;
}
const official = computed(() => `https://playvalorant.com/en-us/agents/${encodeURIComponent(props.agent.agent_name.toLowerCase().replace("/", "-"))}/`);
</script>
<template>
  <section class="section">
    <div class="section-heading"><h2>技能详解</h2><a :href="official" target="_blank" rel="noopener noreferrer">官方特工档案 ↗</a></div>
    <div v-if="agent.abilities?.length" class="ability-grid">
      <article v-for="ability in agent.abilities" :key="ability.english" class="panel ability-card">
        <span class="eyebrow">{{ ability.english }}</span>
        <h3>{{ ability.name }}</h3>
        <p>{{ ability.description }}</p>
        <button class="text-button clip-button" :aria-expanded="selectedClip === ability.english" @click="openSkill(ability)">
          <Play :size="15" />{{ selectedClip === ability.english ? "收起演示" : "观看技能演示" }}
        </button>
        <GuideVideo v-if="selectedClip === ability.english" :src="ability.clip" :fallback="chapterUrl(ability)" :label="ability.name + ' 技能演示'" />
      </article>
    </div>
    <p v-else class="panel preserve-lines">{{ agent.skills }}</p>
  </section>
  <section v-if="film || original" class="section">
    <div class="section-heading"><h2>特工介绍视频</h2><a v-if="original" :href="original" target="_blank" rel="noopener noreferrer">在原平台观看原版 ↗</a></div>
    <GuideVideo v-if="showIntro && film" :src="film" :label="agent.agent_name + ' 特工介绍视频'" />
    <button v-else-if="film" class="intro-cover" @click="openIntro">
      <img :src="`${base}img/agents/${agent.agent_id}.webp`" alt="" loading="lazy" />
      <span><Play :size="24" />播放 {{ agent.agent_name }} 中文技能导览</span>
    </button>
  </section>
</template>
<style scoped>
.section-heading { flex-wrap: wrap; gap: 10px; }
.section-heading a { font-size: .86rem; text-decoration: underline; text-underline-offset: 3px; }
.ability-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; align-items: start; }
.ability-card { padding: clamp(18px, 3vw, 30px); }
.ability-card h3 { margin: 6px 0 10px; font-size: 1.22rem; }
.ability-card p { line-height: 1.85; margin: 0; }
.clip-button { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; }
.ability-card :deep(video) { margin-top: 12px; }
.intro-cover { position: relative; display: grid; align-items: center; justify-items: start; width: 100%; min-height: 170px; padding: 24px; overflow: hidden; border: 0; border-radius: 5px; color: white; background: #223331; cursor: pointer; }
.intro-cover img { position: absolute; right: 4%; top: 0; height: 250%; opacity: .65; }
.intro-cover span { position: relative; display: inline-flex; gap: 10px; align-items: center; background: #172521eb; padding: 12px 18px; border-radius: 4px; font-weight: 700; }
@media(max-width: 680px) { .ability-grid { grid-template-columns: 1fr; } }
</style>
