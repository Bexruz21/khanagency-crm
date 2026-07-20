<script setup>
const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
})

const paths = {
  info: 'M11 17h2v-6h-2v6Zm1-15a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-11h2V7h-2v2Z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm1-13h-2v6l5.2 3.1 1-1.7-4.2-2.5V7Z',
  alert: 'M12 2 1 21h22L12 2Zm0 4 7.5 13h-15L12 6Zm-1 4v4h2v-4h-2Zm0 6v2h2v-2h-2Z',
  check: 'm9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z',
  close: 'M18.3 5.7 16.9 4.3 12 9.2 7.1 4.3 5.7 5.7l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z',
  edit: 'M3 17.3V21h3.7L17.8 9.9l-3.7-3.7L3 17.3ZM20.7 7c.4-.4.4-1 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7L20.7 7Z',
  sparkles: 'm12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Zm7 10 .9 2.1L22 15l-2.1.9L19 18l-.9-2.1L16 15l2.1-.9L19 12ZM5 13l1.2 2.8L9 17l-2.8 1.2L5 21l-1.2-2.8L1 17l2.8-1.2L5 13Z',
  message: 'M4 4h16v12H7l-3 3V4Zm2 2v8h10V6H6Z',
  review: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14-4-4 1.4-1.4 2.6 2.6 4.6-4.6L17 10l-6 6Z',
  paperclip: 'M16.5 6.5 9 14a2.1 2.1 0 0 0 3 3l7-7a4 4 0 0 0-5.7-5.7l-7.6 7.6a6 6 0 0 0 8.5 8.5l6.3-6.3-1.4-1.4-6.3 6.3a4 4 0 1 1-5.7-5.7l7.6-7.6a2 2 0 1 1 2.8 2.8l-7 7a.1.1 0 0 1-.1-.1l7.5-7.5-1.4-1.4Z',
  send: 'M2 21 23 12 2 3v7l15 2-15 2v7Z',
  camera: 'M9 3 7.2 5H4a2 2 0 0 0-2 2v12h20V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  movie: 'M3 3h18v18H3V3Zm2 2v3h3V5H5Zm5 0v3h4V5h-4Zm6 0v3h3V5h-3ZM5 10v9h14v-9H5Z',
  campaign: 'M3 10v4h4l5 4V6l-5 4H3Zm11-3v10c3-.5 5-2.6 5-5s-2-4.5-5-5Z',
  instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  chart: 'M4 19h16v2H2V3h2v16Zm3-2H5v-6h2v6Zm4 0H9V7h2v10Zm4 0h-2V9h2v8Zm4 0h-2V4h2v13Z',
  wallet: 'M3 5a2 2 0 0 1 2-2h13v3h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2 1h11V5H5v1Zm0 2v11h14v-3h-4a3 3 0 0 1 0-6h4V8H5Zm10 4a1 1 0 1 0 0 2h4v-2h-4Z',
  filter: 'M3 5h18v2H3V5Zm3 6h12v2H6v-2Zm4 6h4v2h-4v-2Z',
  archive: 'M4 3h16l2 4v2h-1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9H2V7l2-4Zm1.4 2-1 2h15.2l-1-2H5.4ZM5 9v11h14V9H5Zm4 3h6v2H9v-2Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2-8 4.5V21h16v-2.5C20 16 16.4 14 12 14Z',
  logout: 'M17 7l-1.4 1.4L18.2 11H8v2h10.2l-2.6 2.6L17 17l5-5-5-5ZM4 5h8V3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8v-2H4V5Z',
  'chevron-down': 'm7.4 8.6 4.6 4.6 4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z',
}
</script>

<template>
  <svg class="app-icon" viewBox="0 0 24 24" aria-hidden="true" :width="props.size" :height="props.size">
    <path fill="currentColor" :d="paths[props.name] || paths.info" />
  </svg>
</template>

<style scoped>
.app-icon { display: inline-block; flex: none; vertical-align: -0.15em; }
</style>
