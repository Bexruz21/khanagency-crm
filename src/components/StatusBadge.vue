<script setup>
defineProps({
  map: { type: Object, required: true },
  value: { type: String, required: true },
})
</script>

<template>
  <span
    class="badge"
    :style="{ color: map[value]?.color, background: map[value]?.bg }"
  >{{ map[value]?.label || value }}</span>
</template>

<style scoped>
.badge { white-space: nowrap; flex-shrink: 0; }
</style>
