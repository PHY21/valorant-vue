<script setup>
import { onBeforeUnmount, ref } from "vue";

const props = defineProps({
  src: { type: String, required: true },
  fallback: String,
  label: { type: String, required: true },
});
const source = ref(props.src);
const player = ref(null);
const failed = ref(false);
const slow = ref(false);
let timeout;

function clearWait() {
  clearTimeout(timeout);
  slow.value = false;
}
function alternate() {
  if (props.fallback && source.value !== props.fallback) {
    clearWait();
    source.value = props.fallback;
    return true;
  }
  return false;
}
function onError() {
  clearWait();
  if (!alternate()) failed.value = true;
}
function onWait() {
  clearWait();
  timeout = setTimeout(() => {
    if (!alternate()) slow.value = true;
  }, 12000);
}
function retry() {
  failed.value = false;
  clearWait();
  player.value?.load();
  player.value?.play().catch(() => {});
}
onBeforeUnmount(clearWait);
</script>
<template>
  <video ref="player" :src="source" :aria-label="label" controls playsinline autoplay
    @loadstart="onWait" @waiting="onWait" @canplay="clearWait" @playing="clearWait"
    @error="onError" />
  <div v-if="failed || slow" class="playback-notice" role="status">
    <span>{{ failed ? "视频未能加载。" : "视频加载较慢。" }}</span>
    <button class="text-button" @click="retry">重新加载</button>
    <a :href="source" target="_blank" rel="noopener noreferrer">单独打开视频 ↗</a>
  </div>
</template>
<style scoped>
video { display: block; width: 100%; aspect-ratio: 16/9; background: #152321; border-radius: 5px; }
.playback-notice { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 0; font-size: .875rem; }
.playback-notice a { text-decoration: underline; }
</style>
