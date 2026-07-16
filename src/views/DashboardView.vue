<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import api from '../api'
import UserAvatar from '../components/UserAvatar.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmployeeDashboard from './EmployeeDashboard.vue'
import { PRIORITY, TASK_STATUS, fmtDate } from '../labels'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const data = ref(null)
const isEmployee = computed(() => auth.user?.role === 'employee')
let refreshTimer = null

async function load() {
  if (!auth.user) await auth.fetchMe()
  if (isEmployee.value) return // у сотрудника свой дашборд
  const res = await api.get('/tasks/dashboard/')
  data.value = res.data
}

onMounted(async () => {
  await load()
  if (!isEmployee.value) refreshTimer = setInterval(() => {
    if (!document.hidden) load()
  }, 10000)
})
onUnmounted(() => clearInterval(refreshTimer))

const statCards = [
  { key: 'brands_active', label: 'Проектов в работе', tone: 'accent' },
  { key: 'tasks_open', label: 'Открытых задач', tone: 'sky' },
  { key: 'tasks_today', label: 'Задач на сегодня', tone: 'amber' },
  { key: 'tasks_overdue', label: 'Просрочено', tone: 'red' },
]
</script>

<template>
  <EmployeeDashboard v-if="isEmployee" />

  <div v-else>
    <h1 class="page-title">Дашборд</h1>

    <div v-if="!data" class="stats">
      <div v-for="i in 4" :key="i" class="skeleton" style="height: 92px" />
    </div>

    <template v-else>
      <div class="stats">
        <div v-for="c in statCards" :key="c.key" class="card stat rise" :class="c.tone">
          <span class="num">{{ data.counters[c.key] }}</span>
          <span class="lbl">{{ c.label }}</span>
        </div>
      </div>

      <div class="grid">
        <section class="card panel rise">
          <header>
            <h2>Проекты в работе</h2>
            <RouterLink to="/brands" class="btn ghost sm">Все →</RouterLink>
          </header>
          <RouterLink
            v-for="b in data.brands" :key="b.id"
            :to="`/brands/${b.id}`" class="brand-row"
          >
            <div class="brand-info">
              <strong>{{ b.name }}</strong>
              <span class="muted">{{ b.niche }}</span>
            </div>
            <div class="progress-wrap">
              <div class="progress"><div class="bar" :style="{ width: b.progress + '%' }" /></div>
              <span class="pct">{{ b.progress }}%</span>
            </div>
          </RouterLink>
          <p v-if="!data.brands.length" class="empty">Нет активных проектов</p>
        </section>

        <section class="card panel rise">
          <header><h2>Загрузка команды</h2></header>
          <div v-for="u in data.team" :key="u.id" class="team-row">
            <UserAvatar :user="u" :size="32" />
            <div class="brand-info">
              <strong>{{ u.full_name }}</strong>
              <span class="muted">{{ u.position || '—' }}</span>
            </div>
            <span class="badge" :style="{
              background: u.active_tasks > 3 ? 'var(--red-soft)' : 'var(--accent-soft)',
              color: u.active_tasks > 3 ? 'var(--red)' : 'var(--accent-ink)',
            }">{{ u.active_tasks }} акт.</span>
          </div>
        </section>

        <section class="card panel rise wide" v-if="data.tasks_overdue.length">
          <header><h2 class="danger-title">🔴 Просроченные задачи</h2></header>
          <TaskRow v-for="t in data.tasks_overdue" :key="t.id" :task="t" />
        </section>

        <section class="card panel rise wide">
          <header><h2>Сегодня</h2></header>
          <TaskRow v-for="t in data.tasks_today" :key="t.id" :task="t" />
          <p v-if="!data.tasks_today.length" class="empty">На сегодня дедлайнов нет 🎉</p>
        </section>

        <section class="card panel rise wide">
          <header>
            <h2>Ближайшие дедлайны</h2>
            <RouterLink to="/tasks" class="btn ghost sm">Все задачи →</RouterLink>
          </header>
          <TaskRow v-for="t in data.tasks_upcoming" :key="t.id" :task="t" />
          <p v-if="!data.tasks_upcoming.length" class="empty">Пусто</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script>
import { h, defineComponent } from 'vue'
import { RouterLink } from 'vue-router'
import UserAvatarC from '../components/UserAvatar.vue'
import StatusBadgeC from '../components/StatusBadge.vue'
import { PRIORITY as P, TASK_STATUS as TS, fmtDate as fd } from '../labels'

const TaskRow = defineComponent({
  props: { task: Object },
  setup(props) {
    return () =>
      h(RouterLink, { to: '/tasks', class: 'task-row' }, () => [
        h(UserAvatarC, { user: props.task.assignee_detail, size: 28 }),
        h('div', { class: 'brand-info' }, [
          h('strong', props.task.title),
          h('span', { class: 'muted' }, props.task.brand_name || 'Без проекта'),
        ]),
        h(StatusBadgeC, { map: P, value: props.task.priority }),
        h(StatusBadgeC, { map: TS, value: props.task.status }),
        h('span', { class: 'deadline', style: props.task.is_overdue ? 'color: var(--red)' : '' },
          fd(props.task.deadline, true)),
      ])
  },
})
export default { components: { TaskRow } }
</script>

<style>
.page-title { font-size: 1.5rem; margin-bottom: 20px; }

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.stat { padding: 18px 20px; display: flex; flex-direction: column; gap: 2px; border-left: 4px solid transparent; }
.stat .num { font-size: 1.9rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stat .lbl { color: var(--muted); font-size: 0.85rem; font-weight: 600; }
.stat.accent { border-left-color: var(--accent); }
.stat.sky { border-left-color: var(--sky); }
.stat.amber { border-left-color: var(--amber); }
.stat.red { border-left-color: var(--red); }

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.panel { padding: 16px 18px; }
.panel.wide { grid-column: 1 / -1; }
.panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.panel h2 { font-size: 1.02rem; }
.danger-title { color: var(--red); }

.brand-row, .team-row, .task-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: inherit;
  transition: background-color var(--dur-fast) ease;
}
@media (hover: hover) and (pointer: fine) {
  .brand-row:hover, .task-row:hover { background: var(--sunken); }
}
.brand-info { flex: 1; min-width: 0; line-height: 1.3; }
.brand-info strong { display: block; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.muted { color: var(--muted); font-size: 0.8rem; }

.progress-wrap { display: flex; align-items: center; gap: 8px; width: 140px; }
.progress { flex: 1; height: 6px; border-radius: 4px; background: var(--line); overflow: hidden; }
.progress .bar {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--accent), var(--sky));
  transition: width 500ms var(--ease-in-out);
}
.pct { font-size: 0.8rem; color: var(--muted); font-variant-numeric: tabular-nums; width: 34px; text-align: right; }

.deadline { font-size: 0.83rem; color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.empty { color: var(--muted); font-size: 0.88rem; padding: 8px; }

@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
  .stat { padding: 14px 15px; border-left-width: 3px; }
  .stat .num { font-size: 1.55rem; }
  .stat .lbl { font-size: 0.76rem; line-height: 1.25; }
  .grid { gap: 10px; }
  .panel { padding: 14px; }
  .brand-row, .team-row, .task-row { gap: 9px; padding: 11px 4px; }
  .progress-wrap { width: 92px; }
  .task-row .badge { display: none; }
  .deadline { font-size: 0.75rem; }
}
</style>
