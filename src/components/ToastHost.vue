<script setup>
import { useRouter } from 'vue-router'
import { useToastStore } from '../stores/toasts'

const toasts = useToastStore()
const router = useRouter()

const KIND = {
  info: { icon: 'ℹ️', bar: 'var(--accent)' },
  warning: { icon: '⏰', bar: 'var(--amber)' },
  danger: { icon: '🔴', bar: 'var(--red)' },
  success: { icon: '✓', bar: 'var(--green)' },
}

function open(t) {
  toasts.remove(t.id)
  if (t.link) router.push(t.link)
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-zone" aria-live="polite">
      <TransitionGroup name="toast" :duration="{ enter: 260, leave: 160 }">
        <div
          v-for="t in toasts.items" :key="t.id"
          class="toast" :class="[t.kind, { clickable: t.link }]"
          :style="{ '--bar': KIND[t.kind]?.bar }"
          @click="open(t)"
        >
          <span class="icon">{{ KIND[t.kind]?.icon }}</span>
          <p>{{ t.text }}</p>
          <button class="x" aria-label="Закрыть" @click.stop="toasts.remove(t.id)">✕</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-zone {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(380px, calc(100vw - 36px));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--surface-raised);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 0.5px solid var(--line);
  border-left: 3px solid var(--bar);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  padding: 13px 14px;
  /* transitions, а не keyframes: toast'ы приходят пачками — важна interruptibility */
  transition: transform 240ms var(--ease-drawer), opacity 200ms var(--ease-out);
}
.toast.clickable { cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  .toast.clickable:hover { transform: translateX(-3px); }
}
.toast:active { transform: scale(0.98); }

.icon { flex: none; font-size: 0.95rem; line-height: 1.4; }
.toast.success .icon { color: var(--green); font-weight: 700; }
p { flex: 1; font-size: 0.88rem; line-height: 1.4; font-weight: 500; }

.x {
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 6px;
  flex: none;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}
@media (hover: hover) and (pointer: fine) {
  .x:hover { color: var(--ink); background: var(--sunken); }
}

@media (prefers-reduced-transparency: reduce) {
  .toast { background: var(--surface-solid); backdrop-filter: none; -webkit-backdrop-filter: none; }
}

/* вход справа с лёгким scale (не от 0!), выход быстрее входа */
.toast-enter-from { opacity: 0; transform: translateX(24px) scale(0.97); }
.toast-leave-active { transition: transform 160ms ease, opacity 140ms ease; }
.toast-leave-to { opacity: 0; transform: translateX(12px) scale(0.98); }
.toast-move { transition: transform 240ms var(--ease-in-out); }

@media (prefers-reduced-motion: reduce) {
  .toast-enter-from, .toast-leave-to { transform: none; }
}

@media (max-width: 640px) {
  .toast-zone {
    top: calc(10px + env(safe-area-inset-top));
    right: 10px;
    width: calc(100vw - 20px);
  }
  .toast { min-height: 52px; align-items: center; }
  .x { width: 36px; height: 36px; display: grid; place-items: center; }
}
</style>
