<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from './api'
import { useAuthStore } from './stores/auth'
import { useToastStore } from './stores/toasts'
import { usePresenceStore } from './stores/presence'
import {
  startRealtime,
  stopRealtime,
  subscribeRealtimeEvents,
} from './realtime'
import KhanLogo from './components/KhanLogo.vue'
import ToastHost from './components/ToastHost.vue'
import UserAvatar from './components/UserAvatar.vue'
import { ROLE } from './labels'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toasts = useToastStore()
const presence = usePresenceStore()
const isLogin = computed(() => route.name === 'login')

const collapsed = ref(localStorage.getItem('khan_sidebar') === '1')
const pendingTaskCount = ref(0)
let pendingTaskCountLoading = false
const browserNotificationsSupported = 'Notification' in window
const browserNotificationPermission = ref(
  browserNotificationsSupported ? Notification.permission : 'unsupported',
)
const notificationPromptDismissed = ref(false)
let notificationWorkerPromise = null
const showNotificationPermissionPrompt = computed(() =>
  auth.user
  && browserNotificationsSupported
  && browserNotificationPermission.value === 'default'
  && !notificationPromptDismissed.value
)

function handlePendingTaskDelta(event) {
  pendingTaskCount.value = Math.max(0, pendingTaskCount.value + (Number(event.detail) || 0))
}

async function loadPendingTaskCount() {
  if (!auth.user || !auth.isAuthed || pendingTaskCountLoading) return
  const userId = auth.user.id
  pendingTaskCountLoading = true
  try {
    const { data } = await api.get('/tasks/pending-count/')
    if (auth.user?.id === userId) pendingTaskCount.value = Number(data.count) || 0
  } catch {
    /* При следующем WebSocket ready/data.changed счётчик обновится снова. */
  } finally {
    pendingTaskCountLoading = false
  }
}

function toggleSidebar() {
  collapsed.value = !collapsed.value
  localStorage.setItem('khan_sidebar', collapsed.value ? '1' : '0')
}

function registerNotificationWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  if (!notificationWorkerPromise) {
    notificationWorkerPromise = navigator.serviceWorker
      .register('/notification-sw.js', { updateViaCache: 'none' })
      .catch(() => null)
  }
  return notificationWorkerPromise
}

async function enableBrowserNotifications() {
  if (!browserNotificationsSupported) return
  try {
    browserNotificationPermission.value = await Notification.requestPermission()
    if (browserNotificationPermission.value === 'granted') {
      toasts.push('Уведомления браузера включены.', 'success')
      await registerNotificationWorker()
      await showBrowserNotification({
        id: 'permission-test',
        text: 'Проверка завершена — уведомления KHAN CRM работают.',
        link: '/tasks',
      }, true)
    } else {
      toasts.push('Браузер не разрешил уведомления. Разрешение можно изменить в настройках сайта.', 'warning')
    }
  } catch {
    toasts.push('Не удалось запросить разрешение на уведомления.', 'danger')
  }
}

function dismissNotificationPrompt() {
  notificationPromptDismissed.value = true
}

async function showBrowserNotification(notification, force = false) {
  if (
    !browserNotificationsSupported
    || Notification.permission !== 'granted'
    || (!force && !document.hidden)
  ) return false
  try {
    const registration = await registerNotificationWorker()
    if (registration) {
      await registration.showNotification('KHAN CRM', {
        body: notification.text,
        tag: `khan-crm-${notification.id}`,
        data: { link: notification.link || '/' },
      })
      return true
    }

    const browserNotification = new Notification('KHAN CRM', {
      body: notification.text,
      tag: `khan-crm-${notification.id}`,
    })
    browserNotification.onclick = () => {
      window.focus()
      if (notification.link) router.push(notification.link)
      browserNotification.close()
    }
    return true
  } catch {
    /* Некоторые мобильные браузеры объявляют API, но разрешают уведомления только установленному PWA. */
    return false
  }
}

/* ---- WebSocket-уведомления + одноразовая загрузка пропущенных ---- */
let notificationsLoading = false
let unsubscribeRealtime = null
const deliveredNotificationIds = new Set()

function showNotification(notification) {
  if (deliveredNotificationIds.has(notification.id)) return
  deliveredNotificationIds.add(notification.id)
  if (deliveredNotificationIds.size > 500) {
    deliveredNotificationIds.delete(deliveredNotificationIds.values().next().value)
  }
  showBrowserNotification(notification)
  toasts.push(notification.text, notification.kind, notification.link)
}

async function pollNotifications() {
  // Не забираем уведомления под экраном входа: раньше они сразу становились seen,
  // пока dashboard ещё не был показан, поэтому сотрудник визуально терял toast.
  if (isLogin.value || !auth.user || !auth.isAuthed || notificationsLoading || document.hidden) return
  notificationsLoading = true
  try {
    const { data } = await api.get('/notifications/unseen/')
    if (data.length) {
      for (const n of data) showNotification(n)
      // Сначала гарантируем отрисовку toast, только затем подтверждаем доставку backend.
      await nextTick()
      await api.post('/notifications/mark-seen/', { ids: data.map((n) => n.id) })
    }
  } catch {
    /* сервер недоступен — молча попробуем в следующий раз */
  } finally {
    notificationsLoading = false
  }
}

// App не перемонтируется после login. Ждём одновременно пользователя и завершение перехода
// с /login, чтобы toast появился уже поверх рабочего интерфейса.
watch([() => auth.user?.id, () => route.name], ([userId, routeName]) => {
  if (userId && routeName !== 'login') {
    pollNotifications()
    loadPendingTaskCount()
  }
})

async function handleRealtime(event) {
  if (event.type === 'presence.snapshot') {
    presence.applySnapshot(event.users)
    return
  }
  if (event.type === 'presence.changed') {
    presence.applyChange(event.user)
    return
  }
  if (event.type === 'auth.failed') {
    try {
      await auth.fetchMe()
    } catch {
      auth.logout()
    }
    return
  }
  if (event.type === 'ready') {
    await Promise.all([pollNotifications(), loadPendingTaskCount()])
    return
  }
  if (event.type === 'data.changed' && event.resource === 'tasks') {
    await loadPendingTaskCount()
    return
  }
  if (event.type !== 'notification.created') return
  const n = event.notification
  showNotification(n)
  await nextTick()
  try {
    await api.post('/notifications/mark-seen/', { ids: [n.id] })
  } catch {
    /* При переподключении непрочитанное уведомление придёт через unseen. */
  }
}

onMounted(() => {
  pollNotifications()
  loadPendingTaskCount()
  if (browserNotificationPermission.value === 'granted') {
    registerNotificationWorker().then(async (registration) => {
      const testKey = 'khan_notification_worker_test_v1'
      if (!registration || localStorage.getItem(testKey) === '1') return
      const shown = await showBrowserNotification({
        id: 'worker-test',
        text: 'Системные уведомления KHAN CRM подключены.',
        link: '/tasks',
      }, true)
      if (shown) localStorage.setItem(testKey, '1')
    })
  }
  window.addEventListener('task-pending-delta', handlePendingTaskDelta)
  unsubscribeRealtime = subscribeRealtimeEvents(handleRealtime)
  if (auth.isAuthed) startRealtime()
})
onUnmounted(() => {
  window.removeEventListener('task-pending-delta', handlePendingTaskDelta)
  unsubscribeRealtime?.()
  stopRealtime()
})

watch(() => auth.isAuthed, (isAuthed) => {
  if (isAuthed) {
    startRealtime()
    loadPendingTaskCount()
  }
  else {
    stopRealtime()
    presence.reset()
    pendingTaskCount.value = 0
  }
})

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  brands: 'M12 2 2 7v10l10 5 10-5V7L12 2zm0 2.2L19.5 8 12 11.8 4.5 8 12 4.2zM4 9.6l7 3.5v6.7l-7-3.5V9.6zm9 10.2v-6.7l7-3.5v6.7l-7 3.5z',
  finances: 'M3 5a2 2 0 0 1 2-2h13v3h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm2 3v11h14v-3h-4a3 3 0 0 1 0-6h4V8H5Zm10 4a1 1 0 1 0 0 2h4v-2h-4Z',
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
    { to: '/finances', label: 'Финансы', icon: ICONS.finances },
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

  <div v-else-if="auth.initialized && auth.user" class="shell">
    <Transition name="permission">
      <div v-if="showNotificationPermissionPrompt" class="notification-permission">
        <div>
          <strong>Включить уведомления?</strong>
          <span>Новые задачи и сообщения будут видны, даже когда вкладка в фоне.</span>
        </div>
        <button class="permission-enable" @click="enableBrowserNotifications">Включить</button>
        <button class="permission-close" aria-label="Закрыть" @click="dismissNotificationPrompt">×</button>
      </div>
    </Transition>

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
          :aria-label="item.to === '/tasks' && pendingTaskCount ? `${item.label}: ${pendingTaskCount}` : item.label"
        >
          <svg viewBox="0 0 24 24" width="19" height="19"><path :d="item.icon" fill="currentColor" /></svg>
          <span class="label">{{ item.label }}</span>
          <span v-if="item.to === '/tasks' && pendingTaskCount" class="nav-count">
            {{ Math.min(99, pendingTaskCount) }}
          </span>
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
        <button class="logout label" title="Выйти" aria-label="Выйти" @click="auth.logout()">
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

.notification-permission {
  position: fixed;
  z-index: 190;
  top: 18px;
  left: 50%;
  width: min(520px, calc(100vw - 32px));
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 12px 16px;
  border: 0.5px solid var(--line);
  border-radius: 16px;
  background: var(--surface-raised);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  box-shadow: var(--shadow-lg);
}
.notification-permission div { flex: 1; min-width: 0; }
.notification-permission strong,
.notification-permission span { display: block; }
.notification-permission strong { font-size: .9rem; }
.notification-permission span { margin-top: 2px; color: var(--muted); font-size: .76rem; line-height: 1.3; }
.permission-enable {
  border: 0;
  border-radius: 10px;
  padding: 9px 13px;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-size: .8rem;
  font-weight: 700;
  cursor: pointer;
}
.permission-close {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 9px;
  background: var(--sunken);
  color: var(--muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
}
.permission-enter-active, .permission-leave-active {
  transition: opacity 180ms var(--ease-out), transform 220ms var(--ease-drawer);
}
.permission-enter-from, .permission-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px) scale(.98);
}

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
  border-radius: 24px;
  background: rgb(29 29 31 / 0.86);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 0.5px solid rgb(255 255 255 / 0.14);
  box-shadow: 0 24px 70px rgb(0 0 0 / 0.24), 0 4px 16px rgb(0 0 0 / 0.12), inset 0 0.5px rgb(255 255 255 / 0.16);
  color: rgb(235 235 245 / 0.68);
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
  background: rgb(118 118 128 / 0.2);
  color: rgb(235 235 245 / 0.72);
  width: 28px; height: 28px;
  border-radius: 9px;
  cursor: pointer;
  display: grid;
  place-items: center;
  flex: none;
  transition: background-color var(--dur-fast) ease, transform var(--dur-press) var(--ease-out);
}
.collapse-btn svg, .nav-item svg, .logout svg { display: block; }
.collapse-btn:active { transform: scale(0.92); }
@media (hover: hover) and (pointer: fine) {
  .collapse-btn:hover { background: rgb(118 118 128 / 0.32); color: #fff; }
}

nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
  border-radius: 11px;
  color: inherit;
  text-decoration: none;
  font-weight: 560;
  font-size: 0.93rem;
  transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease,
              transform var(--dur-press) var(--ease-out);
}
.nav-count {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  margin-left: auto;
  padding-inline: 5px;
  place-items: center;
  border-radius: 99px;
  background: #ff453a;
  color: #fff;
  font-size: 0.67rem;
  line-height: 1;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 7px rgb(0 0 0 / 0.22);
}
.nav-item.active .nav-count { background: #fff; color: #0a84ff; }
.collapsed .nav-count {
  position: absolute;
  top: 3px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding-inline: 4px;
  font-size: 0.61rem;
}
.collapsed .nav-item { justify-content: center; gap: 0; padding: 11px 0; width: 46px; margin-inline: auto; }
.nav-item svg { flex: none; }
.nav-item:active { transform: scale(0.97); }
.nav-item.active { background: rgb(10 132 255 / 0.92); color: #fff; box-shadow: 0 4px 14px rgb(0 122 255 / 0.24), inset 0 0.5px rgb(255 255 255 / 0.22); }
@media (hover: hover) and (pointer: fine) {
  .nav-item:hover { background: rgb(118 118 128 / 0.16); color: #fff; }
  .nav-item.active:hover { background: #0a84ff; }
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 2px 0;
  border-top: 0.5px solid rgb(255 255 255 / 0.14);
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
  .user-link:hover { background: rgb(118 118 128 / 0.15); }
}
.who { flex: 1; min-width: 0; line-height: 1.25; }
.who strong { display: block; color: #fff; font-size: 0.87rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.who span { font-size: 0.75rem; color: rgb(235 235 245 / 0.48); }
.logout {
  border: 0;
  background: transparent;
  color: rgb(235 235 245 / 0.48);
  cursor: pointer;
  padding: 0;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  line-height: 0;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease;
}
@media (hover: hover) and (pointer: fine) {
  .logout:hover { color: #fff; background: rgb(118 118 128 / 0.18); }
}

.content {
  overflow-y: auto;
  padding: 14px 32px 48px 26px;
  min-width: 0;
}

@media (max-width: 760px) {
  .notification-permission {
    top: calc(10px + env(safe-area-inset-top));
    align-items: flex-start;
  }
  .shell { display: block; height: 100%; padding: 0; }
  .content {
    height: 100%;
    padding: 18px 14px calc(100px + env(safe-area-inset-bottom));
    overscroll-behavior-y: contain;
  }
  .sidebar,
  .sidebar.collapsed {
    position: fixed;
    z-index: 80;
    left: 10px;
    right: 10px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    width: auto;
    height: 68px;
    padding: 7px 8px;
    border-radius: 30px;
    corner-shape: squircle;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    overflow: visible;
  }
  .top-row { display: none; }
  nav { flex-direction: row; min-width: 0; gap: 2px; }
  .nav-item,
  .collapsed .nav-item {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    min-height: 52px;
    margin: 0;
    padding: 5px 2px 4px;
    flex-direction: row;
    justify-content: center;
    gap: 0;
    border-radius: 22px;
    corner-shape: squircle;
  }
  .nav-item svg { width: 23px; height: 23px; }
  .nav-item .label, .collapsed .nav-item .label { display: none; }
  .nav-count,
  .collapsed .nav-count {
    position: absolute;
    top: 3px;
    right: max(2px, calc(50% - 22px));
    min-width: 18px;
    height: 18px;
    margin: 0;
    padding-inline: 4px;
    font-size: 0.6rem;
  }
  .sidebar-user,
  .collapsed .sidebar-user {
    display: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .sidebar { background: #1c1c1e; backdrop-filter: none; -webkit-backdrop-filter: none; }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar { transition: none; }
}
</style>
