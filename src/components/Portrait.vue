<script setup>
import {computed,ref,watch} from 'vue'
const props=defineProps({player:Object});const failed=ref(false)
const src=computed(()=>`${import.meta.env.BASE_URL}${props.player?.photo_url||''}`)
watch(src,()=>failed.value=false)
</script>
<template><div class="portrait"><img v-if="player?.photo_url&&!failed" :src="src" :alt="player.ign+' 选手照片'" loading="lazy" @error="failed=true"><span v-else class="portrait-fallback">{{player?.ign?.slice(0,2)||'VA'}}</span></div></template>
