<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from './api'
import { useAuthStore } from './stores/auth'
import { useToastStore } from './stores/toasts'
import KhanLogo from './components/KhanLogo.vue'
import ToastHost from './components/ToastHost.vue'
import UserAvatar from './components/UserAvatar.vue'
import { ROLE } from './labels'

const route = useRoute()
const auth = useAuthStore()
const toasts = useToastStore()
const isLogin = computed(() => route.name === 'login')

const collapsed = ref(localStorage.getItem('khan_sidebar') === '1')
function toggleSidebar() {
  collapsed.value = !collapsed.value
  localStorage.setItem('khan_sidebar', collapsed.value ? '1' : '0')
}

/* ---- опрос уведомлений: непросмотренные показываем toast'ом ---- */
let pollTimer = null

async function pollNotifications() {
  if (!auth.isAuthed) return
  try {
    const { data } = await api.get('/notifications/unseen/')
    if (data.length) {
      for (const n of data) toasts.push(n.text, n.kind, n.link)
      await api.post('/notifications/mark-seen/', { ids: data.map((n) => n.id) })
    }
  } catch {
    /* сервер недоступен — молча попробуем в следующий раз */
  }
}

onMounted(() => {
  if (auth.isAuthed && !auth.user) auth.fetchMe().catch(() => {})
  pollNotifications()
  pollTimer = setInterval(pollNotifications, 30000)
})
onUnmounted(() => clearInterval(pollTimer))

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  brands: 'M12 2 2 7v10l10 5 10-5V7L12 2zm0 2.2L19.5 8 12 11.8 4.5 8 12 4.2zM4 9.6l7 3.5v6.7l-7-3.5V9.6zm9 10.2v-6.7l7-3.5v6.7l-7 3.5z',
  tasks: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z',
  content: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 4v10h16V8H4zm2 3h6v2H6v-2zm0 3h9v2H6v-2z',
  team: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  profile: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
}

const nav = computed(() => {
  const isEmployee = auth.user?.role === 'employee'
  if (isEmployee) {
    return [
      { to: '/', label: 'Мой дашборд', icon: ICONS.dashboard },
      { to: '/tasks', label: 'Мои задачи', icon: ICONS.tasks },
      { to: '/my-content', label: 'Контент-план', icon: ICONS.content },
      { to: '/profile', label: 'Профиль', icon: ICONS.profile },
    ]
  }
  return [
    { to: '/', label: 'Дашборд', icon: ICONS.dashboard },
    { to: '/brands', label: 'Бренды', icon: ICONS.brands },
    { to: '/tasks', label: 'Задачи', icon: ICONS.tasks },
    { to: '/team', label: 'Команда', icon: ICONS.team },
    { to: '/profile', label: 'Профиль', icon: ICONS.profile },
  ]
})

function isActive(item) {
  if (item.to === '/') return route.path === '/'
  return route.path.startsWith(item.to)
}
</script>

<template>
  <ToastHost />

  <div v-if="isLogin" class="login-shell">
    <RouterView />
  </div>

  <div v-else class="shell">
    <aside class="sidebar" :class="{ collapsed }">
      <div class="top-row">
        <RouterLink to="/" class="logo">
          <KhanLogo :size="36" light :wordmark="!collapsed" />
        </RouterLink>
        <button class="collapse-btn" :title="collapsed ? 'Развернуть' : 'Свернуть'" @click="toggleSidebar">
          <svg viewBox="0 0 24 24" width="17" height="17" :style="{ transform: collapsed ? 'rotate(180deg)' : '', transition: 'transform 200ms var(--ease-out)' }">
            <path fill="currentColor" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12l4.6-4.6z"/>
          </svg>
        </button>
      </div>

      <nav>
        <RouterLink
          v-for="item in nav" :key="item.to" :to="item.to"
          class="nav-item" :class="{ active: isActive(item) }"
          :title="collapsed ? item.label : ''"
        >
          <svg viewBox="0 0 24 24" width="19" height="19"><path :d="item.icon" fill="currentColor" /></svg>
          <span class="label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-user" v-if="auth.user">
        <RouterLink to="/profile" class="user-link" :title="collapsed ? 'Профиль' : ''">
          <UserAvatar :user="auth.user" :size="34" />
          <div class="who label">
            <strong>{{ auth.user.full_name }}</strong>
            <span>{{ ROLE[auth.user.role] }}</span>
          </div>
        </RouterLink>
        <button class="logout label" title="Выйти" @click="auth.logout()">
          <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
        </button>
      </div>
    </aside>

    <main class="content">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in" :duration="{ enter: 260, leave: 140 }">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.login-shell { height: 100%; }

/* floating-раскладка: sidebar не прилипает к краю, парит с отступом */
.shell {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  height: 100%;
  padding: 14px 0 14px 14px;
}

.sidebar {
  width: 232px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
  border-radius: 22px;
  /* полупрозрачный «материал» в духе Apple */
  background: rgb(20 20 31 / 0.92);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border: 1px solid rgb(255 255 255 / 0.07);
  box-shadow: 0 12px 34px rgb(10 10 25 / 0.25), 0 2px 8px rgb(10 10 25 / 0.12);
  color: #b9b9cc;
  transition: width 260ms var(--ease-drawer), padding 260ms var(--ease-drawer);
  overflow: hidden;
}
.sidebar.collapsed { width: 66px; padding: 16px 10px; }

/* подписи: в свёрнутом виде полностью убираем из потока, чтобы иконки были по центру */
.label { white-space: nowrap; opacity: 1; transition: opacity 140ms var(--ease-out); }
.collapsed .label { display: none; }

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  min-height: 44px;
}
.collapsed .top-row {
  flex-direction: column;
  gap: 8px;
  padding-bottom: 10px;
}

.logo {
  display: flex;
  align-items: center;
  padding-left: 2px;
  text-decoration: none;
  min-width: 0;
}
.collapsed .logo { padding-left: 0; }

.collapse-btn {
  border: 0;
  background: rgb(255 255 255 / 0.07);
  color: #b9b9cc;
  width: 28px; height: 28px;
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex: none;
  transition: background-color var(--dur-fast) ease, transform var(--dur-press) var(--ease-out);
}
.collapse-btn:active { transform: scale(0.92); }
@media (hover: hover) and (pointer: fine) {
  .collapse-btn:hover { background: rgb(255 255 255 / 0.14); color: #fff; }
}

nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.93rem;
  transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease,
              transform var(--dur-press) var(--ease-out);
}
.collapsed .nav-item { justify-content: center; gap: 0; padding: 11px 0; width: 46px; margin-inline: auto; }
.nav-item svg { flex: none; }
.nav-item:active { transform: scale(0.97); }
.nav-item.active { background: rgb(255 255 255 / 0.09); color: #fff; }
@media (hover: hover) and (pointer: fine) {
  .nav-item:hover { background: rgb(255 255 255 / 0.06); color: #fff; }
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 2px 0;
  border-top: 1px solid rgb(255 255 255 / 0.08);
}
.collapsed .sidebar-user { justify-content: center; padding: 10px 0 0; }
.user-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
  border-radius: 10px;
  padding: 4px;
  transition: background-color var(--dur-fast) ease;
}
.collapsed .user-link { flex: none; padding: 0; }
@media (hover: hover) and (pointer: fine) {
  .user-link:hover { background: rgb(255 255 255 / 0.06); }
}
.who { flex: 1; min-width: 0; line-height: 1.25; }
.who strong { display: block; color: #fff; font-size: 0.87rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.who span { font-size: 0.75rem; color: #8d8da5; }
.logout {
  border: 0;
  background: transparent;
  color: #8d8da5;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}
@media (hover: hover) and (pointer: fine) {
  .logout:hover { color: #fff; background: rgb(255 255 255 / 0.08); }
}

.content {
  overflow-y: auto;
  padding: 14px 32px 48px 26px;
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sidebar { transition: none; }
}
</style>
