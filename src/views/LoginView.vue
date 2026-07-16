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
      <p class="hint">демо: admin / admin123</p>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(600px 400px at 20% 10%, rgb(79 70 229 / 0.14), transparent),
    radial-gradient(500px 400px at 85% 90%, rgb(124 108 245 / 0.12), transparent),
    var(--bg);
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 380px;
  padding: 34px 32px 26px;
  text-align: center;
  box-shadow: var(--shadow-lg);
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
  font-weight: 700;
  letter-spacing: -0.024em; /* крупный текст — плотнее, как у Apple */
}
.brand-sub {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.32em;
  margin-left: 0.32em;
  color: var(--accent);
  margin-top: 3px;
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
</style>
