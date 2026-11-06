<script setup>
defineProps({ eyebrow: String, title: String, description: String });
</script>
<template>
  <header class="page-heading">
    <span class="eyebrow">{{ eyebrow }}</span>
    <h1>{{ title }}<span class="red-dot">.</span></h1>
    <p>{{ description }}</p>
    <slot />
  </header>
</template>
