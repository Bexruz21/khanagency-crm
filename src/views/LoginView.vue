<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import KhanLogo from '../components/KhanLogo.vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const username = ref('')
const password = ref('')
const shake = ref(false)

async function submit() {
  const ok = await auth.login(username.value, password.value)
  if (ok) router.push('/')
  else {
    shake.value = false
    requestAnimationFrame(() => (shake.value = true))
  }
}
</script>

<template>
  <div class="login-page">
    <form class="card login-card" :class="{ shake }" @submit.prevent="submit">
      <div class="logo-wrap"><KhanLogo :size="56" :wordmark="false" /></div>
      <h1 class="brand-name">KHAN</h1>
      <p class="brand-sub">MARKETING CRM</p>
      <p class="sub">Управление проектами агентства</p>

      <label class="field">Логин</label>
      <input v-model="username" class="input" autocomplete="username" autofocus required />

      <label class="field" style="margin-top: 12px">Пароль</label>
      <input v-model="password" type="password" class="input" autocomplete="current-password" required />

      <p v-if="auth.error" class="error">{{ auth.error }}</p>

      <button class="btn login-btn" :disabled="auth.loading">
        {{ auth.loading ? 'Входим…' : 'Войти' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(600px 400px at 20% 10%, rgb(0 122 255 / 0.16), transparent),
    radial-gradient(500px 400px at 85% 90%, rgb(90 200 250 / 0.13), transparent),
    var(--bg);
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 380px;
  padding: 34px 32px 26px;
  text-align: center;
  box-shadow: var(--shadow-lg);
  background: var(--surface-raised);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  animation: rise 280ms var(--ease-out) 60ms forwards;
}
@keyframes rise { to { opacity: 1; transform: none; } }

.logo-wrap { margin-bottom: 14px; }
.brand-name {
  font-family: -apple-system, 'SF Pro Display', 'Segoe UI Variable Display',
    'Segoe UI', system-ui, sans-serif;
  font-size: 1.75rem;
  font-weight: 720;
  letter-spacing: -0.035em;
}
.brand-sub {
  font-size: 0.62rem;
  font-weight: 650;
  letter-spacing: 0.32em;
  margin-left: 0.32em;
  color: var(--accent);
  margin-top: 3px;
}
@media (prefers-reduced-transparency: reduce) {
  .login-card { background: var(--surface-solid); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
.sub { color: var(--muted); font-size: 0.87rem; margin: 10px 0 22px; }
label { text-align: left; }
.error { color: var(--red); font-size: 0.85rem; margin-top: 12px; }
.login-btn { width: 100%; justify-content: center; margin-top: 18px; padding: 11px; }
.hint { color: var(--muted); font-size: 0.78rem; margin-top: 14px; }

.shake { animation: shake 320ms var(--ease-out); }
@keyframes shake {
  20% { transform: translateX(-7px); }
  45% { transform: translateX(6px); }
  70% { transform: translateX(-4px); }
  100% { transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .shake { animation: none; }
}
@media (max-width: 480px) {
  .login-page { min-height: 100dvh; height: auto; padding: max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom)); overflow-y: auto; }
  .login-card { padding: 26px 20px 22px; }
  .login-card .input { font-size: 16px; }
  .login-btn { min-height: 46px; }
}
</style>
