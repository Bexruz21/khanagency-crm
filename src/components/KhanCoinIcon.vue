<script setup>
defineProps({ size: { type: Number, default: 22 } })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="coin-icon">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.16" />
    <circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.5" />
    <path d="M8.2 7.4v9.2M15.8 7.4l-7.6 5.2m7.6-5.2v9.2m-7.6-4 7.6 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>

<style scoped>.coin-icon { display: inline-block; flex: none; vertical-align: -0.18em; }</style>
