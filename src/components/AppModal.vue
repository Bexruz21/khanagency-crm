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
  background: rgb(18 18 32 / 0.45);
  backdrop-filter: blur(3px);
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
  /* модалка не привязана к триггеру — origin остаётся center */
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--line);
}
h3 { font-size: 1.05rem; }
.body { padding: 18px 20px; overflow-y: auto; }
footer {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
