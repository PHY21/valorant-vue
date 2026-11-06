<script setup>
import {Heart,ArrowUpRight} from 'lucide-vue-next';import Portrait from './Portrait.vue';import {useCatalog} from '../stores/catalog'
defineProps({player:Object});const store=useCatalog()
</script>
<template><article class="player-card"><RouterLink :to="'/detail/player/'+player.player_id" class="player-visual"><Portrait :player="player"/><span class="tag photo-tag">{{player.team_tag}}</span></RouterLink><button class="save-btn" :class="{saved:store.favorites.includes(player.player_id)}" :aria-label="(store.favorites.includes(player.player_id)?'取消收藏 ':'收藏 ')+player.ign" :aria-pressed="store.favorites.includes(player.player_id)" @click="store.toggle(player.player_id)"><Heart :size="17"/></button><RouterLink :to="'/detail/player/'+player.player_id" class="player-info"><div><h3>{{player.ign}}</h3><p>{{player.nationality}} <span>·</span> {{player.player_role}}</p></div><ArrowUpRight :size="20"/></RouterLink></article></template>
