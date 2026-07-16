<script setup>
defineProps({
  open: Boolean,
  title: String,
  width: { type: String, default: '540px' },
})
const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" :duration="{ enter: 250, leave: 140 }">
      <!-- закрытие только явными кнопками — клик по фону игнорируется -->
      <div v-if="open" class="overlay">
        <div class="modal-box card" :style="{ maxWidth: width }" role="dialog" aria-modal="true">
          <header>
            <h3>{{ title }}</h3>
            <button class="btn ghost sm" aria-label="Закрыть" @click="emit('close')">✕</button>
          </header>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.32);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 100;
}
.modal-box {
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  background: var(--surface-raised);
  backdrop-filter: blur(36px) saturate(180%);
  -webkit-backdrop-filter: blur(36px) saturate(180%);
  /* модалка не привязана к триггеру — origin остаётся center */
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 0.5px solid var(--line);
}
h3 { font-size: 1.08rem; font-weight: 650; }
.body { padding: 18px 20px; overflow-y: auto; }
footer {
  padding: 12px 20px 16px;
  border-top: 0.5px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (prefers-reduced-transparency: reduce) {
  .overlay { backdrop-filter: none; -webkit-backdrop-filter: none; }
  .modal-box { background: var(--surface-solid); backdrop-filter: none; -webkit-backdrop-filter: none; }
}

@media (max-width: 640px) {
  .overlay { align-items: flex-end; padding: 0; }
  .modal-box {
    max-width: none !important;
    max-height: calc(94dvh - env(safe-area-inset-top));
    border-radius: 22px 22px 0 0;
    border-bottom: 0;
  }
  header { min-height: 56px; padding: 12px 14px 10px 18px; }
  header .btn { width: 40px; min-height: 40px; padding: 0; justify-content: center; }
  .body { padding: 16px 18px; }
  footer {
    padding: 12px 18px calc(14px + env(safe-area-inset-bottom));
    flex-wrap: wrap;
  }
  footer :deep(.btn) { min-height: 44px; }
}
</style>
