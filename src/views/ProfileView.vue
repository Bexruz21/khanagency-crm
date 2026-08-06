<script setup>
import { onMounted, reactive, ref } from 'vue'
import api from '../api'
import UserAvatar from '../components/UserAvatar.vue'
import AppIcon from '../components/AppIcon.vue'
import { ROLE } from '../labels'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'

const auth = useAuthStore()
const theme = useThemeStore()

const tgChecking = ref(false)
const tgResult = ref(null)

async function testTelegram() {
  tgChecking.value = true
  tgResult.value = null
  try {
    const { data } = await api.post('/users/test-telegram/', { chat_id: form.telegram_chat_id })
    tgResult.value = data
  } catch (e) {
    tgResult.value = e.response?.data || { ok: false, message: 'Ошибка проверки' }
  } finally {
    tgChecking.value = false
  }
}

const THEMES = [
  { id: 'light', label: 'Светлая', icon: 'M12 7a5 5 0 100 10 5 5 0 000-10zM12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4' },
  { id: 'dark', label: 'Тёмная', icon: 'M12 3a9 9 0 109 9c0-.5 0-1-.1-1.4A7 7 0 0113.4 3.1C13 3 12.5 3 12 3z' },
]
const saving = ref(false)
const saved = ref(false)
const error = ref('')

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6']
const form = reactive({
  first_name: '', last_name: '', email: '', phone: '',
  telegram_chat_id: '', avatar_color: '#4f46e5', password: '',
})

onMounted(async () => {
  if (!auth.user) await auth.fetchMe()
  Object.assign(form, {
    first_name: auth.user.first_name,
    last_name: auth.user.last_name,
    email: auth.user.email,
    phone: auth.user.phone,
    telegram_chat_id: auth.user.telegram_chat_id,
    avatar_color: auth.user.avatar_color,
    password: '',
  })
})

async function save() {
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    const payload = { ...form }
    if (!payload.password) delete payload.password
    const { data } = await api.patch('/users/me/', payload)
    auth.user = data
    form.password = ''
    saved.value = true
    setTimeout(() => (saved.value = false), 2500)
  } catch (e) {
    error.value = e.response?.data?.detail || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="auth.user" class="profile">
    <h1 class="page-title">Профиль</h1>

    <div class="card head rise">
      <UserAvatar :user="{ ...auth.user, avatar_color: form.avatar_color }" :size="62" />
      <div>
        <h2>{{ auth.user.full_name }}</h2>
        <span class="badge role">{{ ROLE[auth.user.role] }}</span>
        <span v-if="auth.user.position" class="muted"> · {{ auth.user.position }}</span>
      </div>
    </div>

    <div class="card theme-card rise">
      <div class="theme-head">
        <strong>Тема оформления</strong>
      </div>
      <div class="theme-switch">
        <button
          v-for="t in THEMES" :key="t.id" type="button"
          class="theme-opt" :class="{ on: theme.theme === t.id }"
          @click="theme.set(t.id)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path :d="t.icon" />
          </svg>
          {{ t.label }}
        </button>
      </div>
    </div>

    <form class="card form rise" @submit.prevent="save">
      <div class="row2">
        <div><label class="field">Имя</label><input v-model="form.first_name" class="input" /></div>
        <div><label class="field">Фамилия</label><input v-model="form.last_name" class="input" /></div>
      </div>
      <div class="row2">
        <div><label class="field">Email</label><input v-model="form.email" type="email" class="input" /></div>
        <div><label class="field">Телефон</label><input v-model="form.phone" class="input" /></div>
      </div>
      <div>
        <label class="field">Telegram chat_id — для личных уведомлений о задачах</label>
        <div class="tg-row">
          <input v-model="form.telegram_chat_id" class="input" placeholder="число от @getidsbot, напр. 512345678" />
          <button type="button" class="btn outline" :disabled="tgChecking" @click="testTelegram">
            {{ tgChecking ? 'Проверяем…' : 'Проверить' }}
          </button>
        </div>
        <p v-if="tgResult" class="tg-note" :class="tgResult.ok ? 'ok' : 'err'">{{ tgResult.message }}</p>
        <p class="tg-hint">
          Как получить id: откройте бота <b><a href="https://t.me/khan_notification_bot">@khan_notification_bot</a></b>, нажмите <b>Start</b>,
          затем напишите боту <b><a href="https://t.me/getidsbot">@getidsbot</a></b> — он пришлёт ваш числовой id. Вставьте его сюда и нажмите «Проверить».
        </p>
      </div>
      <div>
        <label class="field">Новый пароль (оставьте пустым, чтобы не менять)</label>
        <input v-model="form.password" type="password" class="input" autocomplete="new-password" />
      </div>
      <div>
        <label class="field">Цвет аватара</label>
        <div class="colors">
          <button
            v-for="c in COLORS" :key="c" type="button"
            class="color" :class="{ on: form.avatar_color === c }"
            :style="{ background: c }" @click="form.avatar_color = c"
          />
          <label
            class="color custom-color"
            :class="{ on: !COLORS.includes(form.avatar_color) }"
            title="Выбрать любой цвет"
          >
            <input v-model="form.avatar_color" type="color" aria-label="Выбрать любой цвет аватара" />
            <span :style="{ background: form.avatar_color }" />
          </label>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <div class="foot">
        <Transition name="modal">
          <span v-if="saved" class="saved"><AppIcon name="check" :size="16" /> Сохранено</span>
        </Transition>
        <button class="btn" :disabled="saving">{{ saving ? 'Сохраняем…' : 'Сохранить' }}</button>
      </div>
    </form>

    <section class="card mobile-session-card rise">
      <div>
        <strong>Сеанс</strong>
        <span>Завершить текущий сеанс на этом устройстве</span>
      </div>
      <button type="button" class="btn danger mobile-logout" @click="auth.logout()">
        <AppIcon name="logout" :size="18" />
        Выйти из аккаунта
      </button>
    </section>
  </div>
</template>

<style scoped>
.profile { max-width: 640px; }
.head { display: flex; align-items: center; gap: 18px; padding: 22px 24px; margin-bottom: 14px; }
.head h2 { font-size: 1.2rem; margin-bottom: 4px; }
.role { background: var(--accent-soft); color: var(--accent-ink); }
.muted { color: var(--muted); font-size: 0.88rem; }

.theme-card {
  padding: 16px 24px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.theme-head strong { font-size: 0.95rem; }
/* сегмент-переключатель, как в iOS */
.theme-switch {
  display: inline-flex;
  gap: 3px;
  background: var(--sunken);
  border-radius: 10px;
  padding: 3px;
}
.theme-opt {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--ink-2);
  transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease,
              box-shadow var(--dur-fast) ease, transform var(--dur-press) var(--ease-out);
}
.theme-opt svg { flex: none; }
.theme-opt:active { transform: scale(0.96); }
.theme-opt.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }

.tg-row { display: flex; gap: 8px; }
.tg-row .input { flex: 1; }
.tg-row .btn { flex: none; }
.tg-note { font-size: 0.85rem; margin-top: 7px; font-weight: 600; }
.tg-note.ok { color: var(--green); }
.tg-note.err { color: var(--red); }
.tg-hint { font-size: 0.78rem; color: var(--muted); margin-top: 6px; line-height: 1.5; }
.tg-hint b { color: var(--ink-2); }

.form { padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.colors { display: flex; align-items: center; gap: 8px; }
.color {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform var(--dur-press) var(--ease-out), box-shadow var(--dur-fast) ease;
}
.color:active { transform: scale(0.9); }
.color.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink); }
.custom-color {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: conic-gradient(#ef4444, #f59e0b, #10b981, #0ea5e9, #8b5cf6, #ec4899, #ef4444);
}
.custom-color::before {
  position: absolute;
  inset: 3px;
  border-radius: inherit;
  background: var(--surface-solid);
  content: '';
}
.custom-color input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.custom-color span {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  pointer-events: none;
}

.error { color: var(--red); font-size: 0.85rem; }
.foot { display: flex; justify-content: flex-end; align-items: center; gap: 14px; }
.saved { color: var(--green); font-weight: 600; font-size: 0.9rem; }
.mobile-session-card { display: none; }
.tg-hint a {
  text-decoration: none;
  color: var(--accent-ink)
}
@media (max-width: 760px) {
  .mobile-session-card {
    display: flex;
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
    margin-top: 14px;
    padding: 18px;
  }
  .mobile-session-card strong,
  .mobile-session-card span { display: block; }
  .mobile-session-card span {
    margin-top: 4px;
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .mobile-logout { width: 100%; }
}
@media (max-width: 640px) {
  .head { padding: 18px; gap: 14px; }
  .theme-card { padding: 16px 18px; align-items: stretch; flex-direction: column; }
  .theme-switch { width: 100%; }
  .theme-opt { flex: 1; justify-content: center; padding-inline: 8px; min-height: 42px; }
  .form { padding: 18px; }
  .row2 { grid-template-columns: 1fr; }
  .tg-row { flex-direction: column; }
  .tg-row .btn { width: 100%; }
  .colors { flex-wrap: wrap; gap: 12px; }
  .color { width: 32px; height: 32px; }
  .foot { align-items: stretch; flex-direction: column; }
  .foot .btn { width: 100%; }
  .saved { text-align: center; }
}
</style>
