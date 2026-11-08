<script setup>
import { computed, ref, watch } from "vue";
const props = defineProps({ agent: { type: Object, required: true } });
const attempt = ref(0);
watch(() => props.agent.agent_id, () => { attempt.value = 0; });
const src = computed(() => {
  if (attempt.value === 0) return `${import.meta.env.BASE_URL}img/agents/${props.agent.agent_id}.webp`;
  if (attempt.value === 1) return props.agent.icon_url;
  return null;
});
</script>
<template>
  <div class="agent-portrait">
    <img v-if="src" :src="src" :alt="agent.agent_name + ' 特工立绘'" loading="lazy" @error="attempt++" />
    <span v-else>{{ agent.agent_name }}</span>
  </div>
</template>
<style scoped>
.agent-portrait { display: grid; place-items: center; overflow: hidden; background: radial-gradient(ellipse at 55% 55%, #455653, #1f302f 80%); color: white; }
img { display: block; width: 100%; height: 100%; min-height: 0; object-fit: contain; }
</style>
