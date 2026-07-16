<script setup>
import { onMounted, ref } from 'vue'
import api from '../api'
import StatusBadge from '../components/StatusBadge.vue'
import { PRIORITY, TASK_STATUS, fmtDate } from '../labels'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const data = ref(null)

onMounted(async () => {
  const res = await api.get('/tasks/my-stats/')
  data.value = res.data
})

const cards = [
  { key: 'active', label: 'Активных задач', tone: 'accent' },
  { key: 'in_review', label: 'На проверке', tone: 'violet' },
  { key: 'done_total', label: 'Выполнено всего', tone: 'green' },
  { key: 'overdue_now', label: 'Просрочено', tone: 'red' },
]
</script>

<template>
  <div>
    <h1 class="page-title">
      Привет, {{ auth.user?.first_name || auth.user?.username }} 👋
    </h1>

    <div v-if="!data" class="stats">
      <div v-for="i in 4" :key="i" class="skeleton" style="height: 92px" />
    </div>

    <template v-else>
      <div class="stats">
        <div class="card stat rise coins" :class="{ neg: data.counters.khan_coins < 0 }">
          <span class="num">🪙 {{ Number(data.counters.khan_coins).toLocaleString('ru-RU') }}</span>
          <span class="lbl">Khan Coins · +50 000 за задачу в срок</span>
        </div>
        <div v-for="c in cards" :key="c.key" class="card stat rise" :class="c.tone">
          <span class="num">{{ data.counters[c.key] }}</span>
          <span class="lbl">{{ c.label }}</span>
        </div>
      </div>

      <div class="grid">
        <section class="card panel rise perf">
          <h2>Моя успеваемость</h2>
          <div class="perf-ring">
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--line)" stroke-width="11" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke="var(--green)" stroke-width="11" stroke-linecap="round"
                :stroke-dasharray="`${data.counters.on_time_rate * 3.14} 999`"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="67" text-anchor="middle" font-size="24" font-weight="700" fill="var(--ink)">{{ data.counters.on_time_rate }}%</text>
            </svg>
            <div class="perf-facts">
              <p><strong>{{ data.counters.on_time_rate }}%</strong> задач сдано в срок</p>
              <p><strong>{{ data.counters.done_on_time }}</strong> вовремя · <strong>{{ data.counters.done_late }}</strong> с задержкой</p>
              <p>Среднее время выполнения: <strong>{{ data.counters.avg_hours }} ч</strong></p>
            </div>
          </div>
        </section>

        <section class="card panel rise" v-if="data.tasks_overdue.length">
          <h2 class="danger-title">🔴 Просрочено — сначала это</h2>
          <div v-for="t in data.tasks_overdue" :key="t.id" class="trow">
            <div class="tinfo">
              <strong>{{ t.title }}</strong>
              <span class="muted">{{ t.brand_name || 'Без проекта' }}</span>
            </div>
            <span class="deadline red">{{ fmtDate(t.deadline, true) }}</span>
          </div>
        </section>

        <section class="card panel rise" v-else>
          <h2>Сегодня</h2>
          <div v-for="t in data.tasks_today" :key="t.id" class="trow">
            <div class="tinfo">
              <strong>{{ t.title }}</strong>
              <span class="muted">{{ t.brand_name || 'Без проекта' }}</span>
            </div>
            <span class="deadline">{{ fmtDate(t.deadline, true) }}</span>
          </div>
          <p v-if="!data.tasks_today.length" class="empty">На сегодня дедлайнов нет 🎉</p>
        </section>

        <section class="card panel rise wide">
          <header class="phead">
            <h2>Мои текущие задачи</h2>
            <RouterLink to="/tasks" class="btn ghost sm">Все →</RouterLink>
          </header>
          <RouterLink v-for="t in data.tasks_current" :key="t.id" to="/tasks" class="trow link">
            <div class="tinfo">
              <strong>{{ t.title }}</strong>
              <span class="muted">{{ t.brand_name || 'Без проекта' }}</span>
            </div>
            <StatusBadge :map="PRIORITY" :value="t.priority" />
            <StatusBadge :map="TASK_STATUS" :value="t.status" />
            <span class="deadline" :class="{ red: t.is_overdue }">{{ fmtDate(t.deadline, true) }}</span>
          </RouterLink>
          <p v-if="!data.tasks_current.length" class="empty">Активных задач нет</p>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.stat { padding: 18px 20px; display: flex; flex-direction: column; gap: 2px; border-left: 4px solid transparent; }
.stat .num { font-size: 1.9rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat .lbl { color: var(--muted); font-size: 0.85rem; font-weight: 600; }
.stat.accent { border-left-color: var(--accent); }
.stat.violet { border-left-color: #8b5cf6; }
.stat.green { border-left-color: #10b981; }
.stat.red { border-left-color: var(--red); }
.stat.coins { border-left-color: var(--amber); background: color-mix(in srgb, var(--amber) 7%, var(--surface)); }
.stat.coins .num { color: var(--amber); }
.stat.coins.neg { border-left-color: var(--red); background: color-mix(in srgb, var(--red) 7%, var(--surface)); }
.stat.coins.neg .num { color: var(--red); }

.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.panel { padding: 16px 18px; }
.panel.wide { grid-column: 1 / -1; }
.panel h2 { font-size: 1.02rem; margin-bottom: 10px; }
.phead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.danger-title { color: var(--red); }

.perf-ring { display: flex; align-items: center; gap: 20px; }
.perf-facts p { font-size: 0.9rem; color: var(--ink-2); margin-bottom: 5px; }
.perf-facts strong { color: var(--ink); }

.trow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: inherit;
}
.trow.link { transition: background-color var(--dur-fast) ease; }
@media (hover: hover) and (pointer: fine) {
  .trow.link:hover { background: rgb(20 20 40 / 0.04); }
}
.tinfo { flex: 1; min-width: 0; line-height: 1.3; }
.tinfo strong { display: block; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.muted { color: var(--muted); font-size: 0.8rem; }
.deadline { font-size: 0.83rem; color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.deadline.red { color: var(--red); font-weight: 600; }
.empty { color: var(--muted); font-size: 0.88rem; padding: 8px; }

@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
