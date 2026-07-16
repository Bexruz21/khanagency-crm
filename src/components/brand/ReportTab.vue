<script setup>
import { computed, onMounted, ref } from 'vue'
import api, { downloadPdf } from '../../api'
import { CONTENT_STATUS, TASK_STATUS } from '../../labels'

const props = defineProps({ brand: Object })
const report = ref(null)

onMounted(async () => {
  const { data } = await api.get(`/brands/${props.brand.id}/report/`)
  report.value = data
})

const statCards = computed(() => report.value && [
  { label: 'Всего задач', value: report.value.total },
  { label: 'Выполнено в срок', value: report.value.done_on_time, tone: 'green' },
  { label: 'С задержкой', value: report.value.done_late, tone: 'amber' },
  { label: 'Просрочено сейчас', value: report.value.overdue_now, tone: 'red' },
  { label: 'Среднее время', value: report.value.avg_hours + ' ч' },
  { label: 'В срок', value: report.value.on_time_rate + '%', tone: 'green' },
])

const statusRows = computed(() => {
  if (!report.value) return []
  const total = report.value.total || 1
  return Object.entries(report.value.by_status).map(([k, v]) => ({
    key: k,
    label: TASK_STATUS[k]?.label || k,
    color: TASK_STATUS[k]?.color,
    count: v,
    pct: Math.round((v / total) * 100),
  }))
})

const contentRows = computed(() => {
  const c = report.value?.content
  if (!c) return []
  const total = c.total || 1
  return Object.entries(c.by_status).map(([k, v]) => ({
    key: k,
    label: CONTENT_STATUS[k]?.label || k,
    color: CONTENT_STATUS[k]?.color,
    count: v,
    pct: Math.round((v / total) * 100),
  }))
})

const contentCards = computed(() => {
  const c = report.value?.content
  return c && [
    { label: 'Единиц контента', value: c.total },
    { label: 'Опубликовано', value: `${c.published} (${c.publish_rate}%)`, tone: 'green' },
    { label: 'В производстве', value: c.in_production },
    { label: 'Публикаций за 7 дней', value: c.upcoming_week, tone: 'amber' },
    { label: 'Просрочено этапов', value: c.overdue_total, tone: c.overdue_total ? 'red' : 'green' },
    { label: 'Идей в очереди', value: c.ideas },
  ]
})
</script>

<template>
  <div>
    <div v-if="!report" class="skeleton" style="height: 220px" />

    <div v-else>
      <div class="toolbar">
        <div class="ring-wrap card rise">
          <svg viewBox="0 0 120 120" width="110" height="110">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--line)" stroke-width="11" />
            <circle
              cx="60" cy="60" r="50" fill="none"
              stroke="var(--accent)" stroke-width="11" stroke-linecap="round"
              :stroke-dasharray="`${report.progress * 3.14} 999`"
              transform="rotate(-90 60 60)"
              style="transition: stroke-dasharray 600ms var(--ease-in-out)"
            />
            <text x="60" y="67" text-anchor="middle" font-size="24" font-weight="700" fill="var(--ink)">{{ report.progress }}%</text>
          </svg>
          <div>
            <h2>Прогресс проекта</h2>
            <p class="muted">{{ report.done }} из {{ report.total }} задач выполнено</p>
            <button class="btn soft sm" style="margin-top: 10px"
              @click="downloadPdf(`/brands/${brand.id}/report/pdf/`, `Report_${brand.name}.pdf`)">↓ Отчёт в PDF</button>
          </div>
        </div>

        <div class="stats">
          <div v-for="c in statCards" :key="c.label" class="card stat rise" :class="c.tone">
            <span class="num">{{ c.value }}</span>
            <span class="lbl">{{ c.label }}</span>
          </div>
        </div>
      </div>

      <div class="grid2">
        <section class="card panel rise">
          <h2>Этапы задач</h2>
          <p class="muted small">Где сейчас находятся задачи — большие доли в «работе» и «проверке» показывают этапы задержек</p>
          <div v-for="row in statusRows" :key="row.key" class="bar-row">
            <span class="bar-label">{{ row.label }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: row.pct + '%', background: row.color }" />
            </div>
            <span class="bar-num">{{ row.count }}</span>
          </div>
        </section>

        <section class="card panel rise">
          <h2>Эффективность сотрудников</h2>
          <p class="muted small">Кто сдаёт в срок, а кто с опозданием</p>
          <table class="perf-table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th class="c">В&nbsp;срок</th>
                <th class="c">Опозд.</th>
                <th class="c">Проср.</th>
                <th class="c">% в&nbsp;срок</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in report.by_assignee" :key="r.user">
                <td>
                  <span class="emp">
                    <span class="dot" :style="{ background: r.color }" />
                    {{ r.user }}
                  </span>
                </td>
                <td class="c"><span class="chip green" v-if="r.on_time">{{ r.on_time }}</span><span v-else class="zero">0</span></td>
                <td class="c"><span class="chip amber" v-if="r.late">{{ r.late }}</span><span v-else class="zero">0</span></td>
                <td class="c"><span class="chip red" v-if="r.overdue">{{ r.overdue }}</span><span v-else class="zero">0</span></td>
                <td class="c">
                  <span v-if="r.on_time_rate !== null" class="rate"
                    :class="r.on_time_rate >= 80 ? 'good' : r.on_time_rate >= 50 ? 'mid' : 'bad'">
                    {{ r.on_time_rate }}%
                  </span>
                  <span v-else class="zero">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <h2 class="section-title rise">Контент-план</h2>
      <div class="stats content-stats">
        <div v-for="c in contentCards" :key="c.label" class="card stat rise" :class="c.tone">
          <span class="num">{{ c.value }}</span>
          <span class="lbl">{{ c.label }}</span>
        </div>
      </div>

      <div class="grid2">
        <section class="card panel rise">
          <h2>Этапы контента</h2>
          <p class="muted small">Распределение по жизненному циклу: Идея → Опубликовано</p>
          <div v-for="row in contentRows" :key="row.key" class="bar-row">
            <span class="bar-label">{{ row.label }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: row.pct + '%', background: row.color }" />
            </div>
            <span class="bar-num">{{ row.count }}</span>
          </div>
          <p v-if="!contentRows.length" class="muted small">В контент-плане пока пусто</p>
        </section>

        <section class="card panel rise">
          <h2>Просроченные этапы</h2>
          <p class="muted small">Дата этапа прошла, а запись ещё не продвинулась дальше</p>
          <div class="overdue-row" :class="{ ok: !report.content.overdue.shooting }">
            <span>📸 Съёмка</span><strong>{{ report.content.overdue.shooting }}</strong>
          </div>
          <div class="overdue-row" :class="{ ok: !report.content.overdue.editing }">
            <span>🎬 Монтаж</span><strong>{{ report.content.overdue.editing }}</strong>
          </div>
          <div class="overdue-row" :class="{ ok: !report.content.overdue.publish }">
            <span>📢 Публикация</span><strong>{{ report.content.overdue.publish }}</strong>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: grid; grid-template-columns: auto 1fr; gap: 14px; margin-bottom: 14px; }
.ring-wrap { display: flex; align-items: center; gap: 18px; padding: 18px 24px; }
.ring-wrap h2 { font-size: 1.05rem; }
.muted { color: var(--muted); font-size: 0.85rem; }
.small { margin-bottom: 12px; }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.stat { padding: 14px 16px; display: flex; flex-direction: column; }
.stat .num { font-size: 1.45rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat .lbl { color: var(--muted); font-size: 0.78rem; font-weight: 600; }
.stat.green .num { color: var(--green); }
.stat.amber .num { color: var(--amber); }
.stat.red .num { color: var(--red); }

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.panel { padding: 18px 20px; }
.panel h2 { font-size: 1.02rem; margin-bottom: 6px; }

.bar-row { display: flex; align-items: center; gap: 12px; padding: 7px 0; }
.bar-label { width: 120px; font-size: 0.86rem; }
.bar-track { flex: 1; height: 9px; background: var(--line); border-radius: 6px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 6px; transition: width 500ms var(--ease-in-out); }
.bar-num { width: 26px; text-align: right; font-size: 0.86rem; font-variant-numeric: tabular-nums; }

table { width: 100%; border-collapse: collapse; font-size: 0.89rem; margin-top: 8px; }
th { text-align: left; font-size: 0.73rem; text-transform: uppercase; color: var(--muted); padding: 8px 6px; border-bottom: 1px solid var(--line); }
td { padding: 9px 6px; border-bottom: 1px solid var(--line); }
tr:last-child td { border-bottom: 0; }
.pct-cell { color: var(--accent-ink); font-weight: 700; font-variant-numeric: tabular-nums; }

.perf-table th.c, .perf-table td.c { text-align: center; }
.emp { display: inline-flex; align-items: center; gap: 8px; }
.emp .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.perf-table .chip {
  display: inline-block;
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.perf-table .chip.green { background: var(--green-soft); color: var(--green); }
.perf-table .chip.amber { background: var(--amber-soft); color: var(--amber); }
.perf-table .chip.red { background: var(--red-soft); color: var(--red); }
.perf-table .zero { color: var(--muted); }
.rate { font-weight: 700; font-variant-numeric: tabular-nums; }
.rate.good { color: var(--green); }
.rate.mid { color: var(--amber); }
.rate.bad { color: var(--red); }

.section-title { font-size: 1.15rem; margin: 22px 0 12px; }
.content-stats { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 14px; }
.content-stats .num { font-size: 1.25rem; }

.overdue-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  background: var(--red-soft);
  color: var(--red);
  font-weight: 600;
  font-size: 0.92rem;
  margin-bottom: 8px;
}
.overdue-row.ok { background: var(--green-soft); color: var(--green); }
.overdue-row strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; }

@media (max-width: 1000px) {
  .toolbar, .grid2 { grid-template-columns: 1fr; }
}
</style>
