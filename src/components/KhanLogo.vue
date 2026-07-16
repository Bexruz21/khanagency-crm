<script setup>
defineProps({
  size: { type: Number, default: 36 },
  wordmark: { type: Boolean, default: true }, // текст рядом со знаком
  light: { type: Boolean, default: false },   // светлый текст (для тёмного sidebar)
})
</script>

<template>
  <span class="khan-logo" :class="{ light }">
    <!-- фирменный знак: монограмма K с искрой -->
    <svg :width="size" :height="size" viewBox="0 0 48 48" class="mark" aria-hidden="true">
      <defs>
        <linearGradient id="khan-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5ac8fa" />
          <stop offset="0.55" stop-color="#0a84ff" />
          <stop offset="1" stop-color="#0066cc" />
        </linearGradient>
        <linearGradient id="khan-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.22" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#khan-grad)" />
      <rect x="1.5" y="1.5" width="45" height="22" rx="13" fill="url(#khan-shine)" />
      <!-- K -->
      <path
        d="M15 12 h5.4 v10.2 L29.6 12 h6.6 L26 23.2 37 36 h-6.9 l-7.7-9.4 -2 2.2 V36 H15 Z"
        fill="#fff"
      />
      <!-- искра — мотив AI -->
      <path
        d="M36.5 8.5 l1.15 2.85 L40.5 12.5 l-2.85 1.15 L36.5 16.5 l-1.15-2.85 L32.5 12.5 l2.85-1.15 Z"
        fill="#fde68a"
      />
    </svg>

    <span v-if="wordmark" class="word">
      <span class="khan">KHAN</span>
      <span class="crm">MARKETING CRM</span>
    </span>
  </span>
</template>

<style scoped>
.khan-logo { display: inline-flex; align-items: center; gap: 11px; }
.mark { flex: none; filter: drop-shadow(0 5px 12px rgb(0 122 255 / 0.28)); }

.word { display: flex; flex-direction: column; line-height: 1.05; min-width: 0; }
/* типографика в духе Apple: SF Pro, плотный отрицательный трекинг у крупного текста */
.khan {
  font-family: -apple-system, 'SF Pro Display', 'Segoe UI Variable Display',
    'Segoe UI', system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.22rem;
  letter-spacing: -0.022em;
  color: var(--ink);
}
.crm {
  font-family: -apple-system, 'SF Pro Text', 'Segoe UI Variable Text',
    'Segoe UI', system-ui, sans-serif;
  font-size: 0.56rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  color: var(--accent-ink-soft, var(--accent));
  margin-top: 2px;
}
.light .khan { color: #fff; }
.light .crm { color: #64d2ff; }
</style>
