<script setup>
import { computed, onMounted, ref } from 'vue'
import api, { downloadPdf } from '../../api'
import AppIcon from '../AppIcon.vue'
import { TASK_STATUS } from '../../labels'

const props = defineProps({ brand: Object })
const report = ref(null)
const loading = ref(true)
const error = ref('')
const period = ref('30')
const pdfLoading = ref(false)

const number = new Intl.NumberFormat('ru-RU')
const formatNumber = (value) => number.format(Number(value) || 0)

async function loadReport() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(`/brands/${props.brand.id}/report/`, { params: { period: period.value } })
    report.value = data
  } catch (err) {
    error.value = err.response?.data?.detail || 'Не удалось загрузить отчёт'
  } finally {
    loading.value = false
  }
}

async function exportPdf() {
  pdfLoading.value = true
  try {
    await downloadPdf(
      `/brands/${props.brand.id}/report/pdf/?period=${period.value}`,
      `Report_${props.brand.name}.pdf`,
    )
  } finally {
    pdfLoading.value = false
  }
}

onMounted(loadReport)

const instagram = computed(() => report.value?.content?.instagram || {})

const headline = computed(() => {
  const content = report.value?.content
  if (!content?.total) return 'Добавьте контент-план, чтобы увидеть результат проекта'
  if (content.overdue_total) {
    return `Опубликовано ${content.published} из ${content.total}. ${content.overdue_total} этапов требуют внимания`
  }
  return `Опубликовано ${content.published} из ${content.total} материалов. Производство идёт по плану`
})

const kpis = computed(() => {
  if (!report.value) return []
  const content = report.value.content
  return [
    { label: 'Выполнение плана', value: `${content.publish_rate}%`, note: `${content.published} из ${content.total}`, tone: 'accent', delta: report.value.comparison?.content_published },
    { label: 'Просмотры Instagram', value: formatNumber(instagram.value.views), note: `${instagram.value.measured_publications || 0} публикаций`, tone: 'violet', delta: report.value.comparison?.instagram_views },
    { label: 'Вовлечённость', value: `${instagram.value.engagement_rate || 0}%`, note: 'ER по просмотрам', tone: 'green' },
    { label: 'Публикации вовремя', value: `${content.publication_punctuality}%`, note: `${content.published_on_time} в срок`, tone: content.published_late ? 'amber' : 'green' },
    { label: 'Задачи выполнены', value: `${report.value.done}/${report.value.total}`, note: `${report.value.on_time_rate}% в срок`, tone: 'sky', delta: report.value.comparison?.tasks_done },
  ]
})

const taskRows = computed(() => {
  if (!report.value) return []
  const total = report.value.total || 1
  return Object.entries(report.value.by_status).map(([key, count]) => ({
    key,
    label: TASK_STATUS[key]?.label || key,
    color: TASK_STATUS[key]?.color || 'var(--accent)',
    count,
    pct: Math.round((count / total) * 100),
  }))
})

const maxFormatViews = computed(() => Math.max(1, ...(report.value?.content?.formats || []).map(item => item.views)))
const maxTeamTasks = computed(() => Math.max(1, ...(report.value?.by_assignee || []).map(item => item.total)))

function deltaLabel(value) {
  if (value === undefined || value === null) return ''
  if (value === 0) return 'без изменений'
  return `${value > 0 ? '+' : ''}${formatNumber(value)} к прошлому периоду`
}

function rateClass(value) {
  if (value === null || value === undefined) return 'neutral'
  return value >= 80 ? 'positive' : value >= 50 ? 'warning' : 'negative'
}
</script>

<template>
  <section class="report-shell">
    <header class="report-header">
      <div>
        <span class="eyebrow">Аналитика проекта</span>
        <h1>Отчёт по бренду</h1>
        <p>Контент, результаты, сроки и вклад команды в одном представлении</p>
      </div>
      <div class="report-actions">
        <label class="period-control">
          <span>Период</span>
          <select v-model="period" class="select" @change="loadReport">
            <option value="7">7 дней</option>
            <option value="30">30 дней</option>
            <option value="90">90 дней</option>
            <option value="all">Всё время</option>
          </select>
        </label>
        <button class="btn outline export-button" :disabled="pdfLoading || loading" @click="exportPdf">
          <AppIcon name="review" :size="17" />
          {{ pdfLoading ? 'Готовим…' : 'Скачать PDF' }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="report-loading" aria-label="Загрузка отчёта">
      <div class="skeleton hero-skeleton" />
      <div class="skeleton-grid"><div v-for="i in 5" :key="i" class="skeleton" /></div>
      <div class="skeleton chart-skeleton" />
    </div>

    <div v-else-if="error" class="report-error card">
      <AppIcon name="alert" :size="24" />
      <strong>{{ error }}</strong>
      <button class="btn soft sm" @click="loadReport">Повторить</button>
    </div>

    <div v-else-if="report" class="report-content">
      <section class="executive card">
        <div class="executive-copy">
          <div class="period-line">
            <span>{{ report.period.label }}</span>
            <span>Обновлено {{ new Date(report.generated_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) }}</span>
          </div>
          <h2>{{ headline }}</h2>
          <p>{{ report.brand_info.description }}</p>
          <div class="project-meta">
            <span><strong>{{ report.brand_info.manager }}</strong> Project Manager</span>
            <span><strong>{{ report.brand_info.team_size }}</strong> участников</span>
            <span><strong>{{ report.brand_info.status }}</strong> статус</span>
          </div>
        </div>
        <div class="score-block">
          <div class="score-ring" :style="{ '--score': report.content.publish_rate }">
            <div><strong>{{ report.content.publish_rate }}%</strong><span>плана</span></div>
          </div>
          <p>{{ report.content.published }} опубликовано</p>
        </div>
      </section>

      <div class="kpi-grid">
        <article v-for="item in kpis" :key="item.label" class="kpi" :class="`tone-${item.tone}`">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <footer>
            <small>{{ item.note }}</small>
            <small v-if="report.comparison?.available && item.delta !== undefined" :class="{ up: item.delta > 0, down: item.delta < 0 }">
              {{ deltaLabel(item.delta) }}
            </small>
          </footer>
        </article>
      </div>

      <div v-if="report.insights?.length" class="insight-strip">
        <article v-for="item in report.insights" :key="item.text" class="insight" :class="item.tone">
          <span class="insight-icon"><AppIcon :name="item.tone === 'red' ? 'alert' : item.tone === 'green' ? 'check' : 'info'" :size="17" /></span>
          <p>{{ item.text }}</p>
        </article>
      </div>

      <div class="section-heading">
        <div>
          <span class="eyebrow">Главный результат</span>
          <h2>Контент и публикации</h2>
          <p>От идеи до публикации и фактического результата в Instagram</p>
        </div>
      </div>

      <div class="content-dashboard">
        <section class="panel card pipeline-panel">
          <div class="panel-head">
            <div><h3>Производственная воронка</h3><p>Сколько материалов дошло до каждого этапа</p></div>
            <span class="panel-value">{{ report.content.total }} материалов</span>
          </div>
          <div v-if="report.content.total" class="funnel-chart">
            <div v-for="(stage, index) in report.content.funnel" :key="stage.key" class="funnel-stage">
              <div class="funnel-label"><span>{{ stage.label }}</span><strong>{{ stage.count }}</strong></div>
              <div class="funnel-track">
                <span :style="{ width: `${Math.max(stage.count ? 8 : 0, (stage.count / report.content.total) * 100)}%` }" />
              </div>
              <small>{{ index ? `${Math.round(stage.count / report.content.total * 100)}% от плана` : '100% плана' }}</small>
            </div>
          </div>
          <div v-else class="empty-panel"><AppIcon name="campaign" :size="26" /><strong>Контент-план пока пуст</strong><span>После добавления материалов здесь появится воронка производства</span></div>
        </section>

        <section class="panel card instagram-panel">
          <div class="panel-head">
            <div><h3>Результаты Instagram</h3><p>Суммарные метрики опубликованного контента</p></div>
            <AppIcon name="instagram" :size="22" />
          </div>
          <div class="instagram-primary">
            <div><strong>{{ formatNumber(instagram.views) }}</strong><span>просмотров</span></div>
            <div class="er-badge"><strong>{{ instagram.engagement_rate || 0 }}%</strong><span>средний ER</span></div>
          </div>
          <div class="instagram-secondary">
            <div><span>Лайки</span><strong>{{ formatNumber(instagram.likes) }}</strong></div>
            <div><span>Комментарии</span><strong>{{ formatNumber(instagram.comments) }}</strong></div>
            <div><span>С метриками</span><strong>{{ instagram.measured_publications || 0 }}</strong></div>
          </div>
          <p v-if="!instagram.measured_publications" class="data-note">Добавьте ссылку Instagram в опубликованный материал и синхронизируйте метрики.</p>
        </section>
      </div>

      <div class="analytics-grid">
        <section class="panel card format-panel">
          <div class="panel-head"><div><h3>Эффективность форматов</h3><p>Сравнение просмотров Reels, постов и Stories</p></div></div>
          <div class="format-chart">
            <div v-for="item in report.content.formats" :key="item.key" class="format-row">
              <div class="format-label"><strong>{{ item.label }}</strong><span>{{ item.published }} опубликовано</span></div>
              <div class="format-bar"><span :style="{ width: `${item.views / maxFormatViews * 100}%` }" /></div>
              <div class="format-result"><strong>{{ formatNumber(item.views) }}</strong><span>{{ item.engagement_rate }}% ER</span></div>
            </div>
          </div>
        </section>

        <section class="panel card deadline-panel">
          <div class="panel-head"><div><h3>Контроль производства</h3><p>Этапы, которые требуют внимания</p></div><strong :class="{ danger: report.content.overdue_total }">{{ report.content.overdue_total }}</strong></div>
          <div class="deadline-list">
            <div :class="{ clear: !report.content.overdue.shooting }"><span><AppIcon name="camera" :size="17" /> Съёмка</span><strong>{{ report.content.overdue.shooting }}</strong></div>
            <div :class="{ clear: !report.content.overdue.editing }"><span><AppIcon name="movie" :size="17" /> Монтаж</span><strong>{{ report.content.overdue.editing }}</strong></div>
            <div :class="{ clear: !report.content.overdue.publish }"><span><AppIcon name="campaign" :size="17" /> Публикация</span><strong>{{ report.content.overdue.publish }}</strong></div>
          </div>
          <div class="punctuality">
            <div><span>Публикации вовремя</span><strong>{{ report.content.publication_punctuality }}%</strong></div>
            <div class="progress-track"><span :style="{ width: `${report.content.publication_punctuality}%` }" /></div>
            <small>{{ report.content.published_on_time }} вовремя · {{ report.content.published_late }} с задержкой</small>
          </div>
        </section>
      </div>

      <section class="panel card top-content-panel">
        <div class="panel-head"><div><h3>Лучшие публикации</h3><p>Материалы с самым сильным фактическим результатом</p></div><span class="panel-value">Топ {{ report.content.top_content.length }}</span></div>
        <div v-if="report.content.top_content.length" class="publication-list">
          <article v-for="(item, index) in report.content.top_content" :key="item.title" class="publication-row">
            <span class="rank">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="publication-title"><strong>{{ item.title }}</strong><span>{{ item.format }} · {{ item.assignee }}</span></div>
            <div class="publication-metric"><strong>{{ formatNumber(item.views) }}</strong><span>просмотров</span></div>
            <div class="publication-metric"><strong>{{ formatNumber(item.likes) }}</strong><span>лайков</span></div>
            <div class="publication-metric"><strong>{{ item.engagement_rate }}%</strong><span>ER</span></div>
            <a v-if="item.publication_url" :href="item.publication_url" target="_blank" rel="noopener" class="publication-link" aria-label="Открыть публикацию"><AppIcon name="instagram" :size="17" /></a>
          </article>
        </div>
        <div v-else class="empty-panel compact"><AppIcon name="chart" :size="24" /><strong>Результатов пока нет</strong><span>Топ сформируется после синхронизации Instagram</span></div>
      </section>

      <div class="section-heading operations-heading">
        <div><span class="eyebrow">Рабочий процесс</span><h2>Задачи и команда</h2><p>Что влияет на скорость выпуска контента</p></div>
      </div>

      <div class="operations-grid">
        <section class="panel card task-panel">
          <div class="panel-head"><div><h3>Состояние задач</h3><p>{{ report.done }} из {{ report.total }} выполнено</p></div><strong>{{ report.progress }}%</strong></div>
          <div class="status-stack" aria-label="Распределение задач по статусам">
            <span v-for="item in taskRows" :key="item.key" :style="{ width: `${item.pct}%`, background: item.color }" :title="`${item.label}: ${item.count}`" />
          </div>
          <div class="task-bars">
            <div v-for="item in taskRows" :key="item.key" class="task-row">
              <span><i :style="{ background: item.color }" />{{ item.label }}</span>
              <div class="progress-track"><span :style="{ width: `${item.pct}%`, background: item.color }" /></div>
              <strong>{{ item.count }}</strong>
            </div>
          </div>
          <div class="task-facts">
            <span><strong>{{ report.on_time_rate }}%</strong> выполнено в срок</span>
            <span><strong>{{ report.overdue_now }}</strong> просрочено сейчас</span>
            <span><strong>{{ report.avg_hours }} ч</strong> среднее время</span>
          </div>
        </section>

        <section class="panel card team-panel">
          <div class="panel-head"><div><h3>Вклад команды</h3><p>Выполнение и соблюдение дедлайнов</p></div><span class="panel-value">{{ report.by_assignee.length }} участников</span></div>
          <div v-if="report.by_assignee.length" class="team-list">
            <article v-for="person in report.by_assignee" :key="person.user" class="team-row">
              <span class="person-dot" :style="{ background: person.color }" />
              <div class="person-main"><strong>{{ person.user }}</strong><span>{{ person.done }} из {{ person.total }} выполнено</span></div>
              <div class="team-meter"><span :style="{ width: `${person.total / maxTeamTasks * 100}%` }" /></div>
              <div class="person-rate" :class="rateClass(person.on_time_rate)"><strong>{{ person.on_time_rate ?? '—' }}{{ person.on_time_rate !== null ? '%' : '' }}</strong><span>в срок</span></div>
              <div class="person-flags"><span class="positive">{{ person.on_time }} вовремя</span><span v-if="person.overdue" class="negative">{{ person.overdue }} просрочено</span></div>
            </article>
          </div>
          <div v-else class="empty-panel compact"><AppIcon name="user" :size="24" /><strong>Нет назначенных исполнителей</strong><span>Статистика появится после назначения задач</span></div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.report-shell{min-width:0}.report-header,.panel-head,.period-line,.project-meta,.instagram-primary,.instagram-secondary,.format-row,.publication-row,.task-row,.task-facts,.team-row{display:flex;align-items:center}.report-header{justify-content:space-between;gap:20px;margin-bottom:18px}.report-header h1{font-size:1.55rem;letter-spacing:-.025em}.report-header p,.section-heading p,.panel-head p{margin-top:4px;color:var(--muted);font-size:.8rem}.eyebrow{display:block;margin-bottom:5px;color:var(--accent);font-size:.67rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.report-actions{display:flex;align-items:flex-end;gap:9px}.period-control{display:flex;flex-direction:column;gap:4px}.period-control>span{color:var(--muted);font-size:.67rem;font-weight:700}.period-control .select{min-width:142px}.export-button{min-height:40px;white-space:nowrap}.report-loading{display:grid;gap:12px}.hero-skeleton{height:190px}.skeleton-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.skeleton-grid .skeleton{height:108px}.chart-skeleton{height:320px}.report-error{display:flex;min-height:220px;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:var(--red)}.report-content{display:flex;flex-direction:column;gap:14px}.executive{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:30px;overflow:hidden;padding:26px 28px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 9%,var(--surface)) 0%,var(--surface) 58%)}.executive:before{position:absolute;top:-80px;right:-30px;width:240px;height:240px;border-radius:50%;background:color-mix(in srgb,var(--accent) 7%,transparent);content:""}.period-line{gap:12px;color:var(--muted);font-size:.68rem}.period-line span+span:before{margin-right:12px;content:"·"}.executive h2{max-width:760px;margin:12px 0 8px;font-size:1.48rem;line-height:1.18;letter-spacing:-.025em}.executive-copy>p{max-width:720px;color:var(--ink-2);font-size:.84rem;line-height:1.5}.project-meta{flex-wrap:wrap;gap:8px 20px;margin-top:18px;color:var(--muted);font-size:.72rem}.project-meta strong{margin-right:5px;color:var(--ink)}.score-block{position:relative;z-index:1;text-align:center}.score-ring{display:grid;width:124px;height:124px;place-items:center;border-radius:50%;background:conic-gradient(var(--accent) calc(var(--score)*1%),var(--line) 0);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 10%,transparent)}.score-ring:before{position:absolute;width:94px;height:94px;border-radius:50%;background:var(--surface-solid);content:""}.score-ring>div{position:relative;z-index:1;display:flex;flex-direction:column}.score-ring strong{font-size:1.55rem}.score-ring span,.score-block>p{color:var(--muted);font-size:.68rem}.score-block>p{margin-top:7px}.kpi-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.kpi{--tone:var(--accent);min-width:0;padding:15px 16px;border:1px solid var(--line);border-top:3px solid var(--tone);border-radius:var(--radius-sm);background:var(--surface)}.tone-green{--tone:var(--green)}.tone-amber{--tone:var(--amber)}.tone-violet{--tone:var(--violet)}.tone-sky{--tone:var(--sky)}.kpi>span{display:block;overflow:hidden;color:var(--muted);font-size:.68rem;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.kpi>strong{display:block;margin:8px 0 10px;font-size:1.28rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.kpi footer{display:flex;min-height:30px;flex-direction:column;gap:2px}.kpi small{color:var(--muted);font-size:.63rem}.kpi small.up{color:var(--green)}.kpi small.down{color:var(--red)}.insight-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px}.insight{display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border-radius:var(--radius-sm);background:var(--accent-soft);color:var(--accent-ink)}.insight.green{background:var(--green-soft);color:var(--green)}.insight.amber{background:var(--amber-soft);color:var(--amber)}.insight.red{background:var(--red-soft);color:var(--red)}.insight-icon{display:grid;width:25px;height:25px;flex:none;place-items:center;border-radius:8px;background:color-mix(in srgb,currentColor 12%,transparent)}.insight p{color:currentColor;font-size:.75rem;font-weight:600;line-height:1.45}.section-heading{margin-top:14px}.section-heading h2{font-size:1.22rem;letter-spacing:-.015em}.content-dashboard{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.8fr);gap:14px}.analytics-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(290px,.65fr);gap:14px}.panel{min-width:0;padding:18px 20px}.panel-head{justify-content:space-between;gap:12px;margin-bottom:17px}.panel-head h3{font-size:.95rem}.panel-value{color:var(--muted);font-size:.69rem;font-weight:700}.funnel-chart{display:flex;flex-direction:column;gap:11px}.funnel-stage{display:grid;grid-template-columns:130px minmax(80px,1fr) 90px;align-items:center;gap:12px}.funnel-label{display:flex;justify-content:space-between;gap:8px;font-size:.75rem}.funnel-label strong{font-variant-numeric:tabular-nums}.funnel-track,.progress-track,.format-bar,.team-meter{height:8px;overflow:hidden;border-radius:99px;background:var(--line)}.funnel-track span,.progress-track span,.format-bar span,.team-meter span{display:block;height:100%;border-radius:inherit;background:var(--accent);transition:width 500ms var(--ease-in-out)}.funnel-stage small{color:var(--muted);font-size:.65rem;text-align:right}.instagram-panel{background:linear-gradient(145deg,color-mix(in srgb,var(--violet) 7%,var(--surface)),var(--surface) 60%)}.instagram-primary{justify-content:space-between;gap:16px;padding:8px 0 18px}.instagram-primary>div{display:flex;flex-direction:column}.instagram-primary strong{font-size:2rem;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.instagram-primary span{color:var(--muted);font-size:.68rem}.er-badge{align-items:flex-end}.er-badge strong{color:var(--violet);font-size:1.3rem}.instagram-secondary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.instagram-secondary>div{padding:10px;border:1px solid color-mix(in srgb,var(--violet) 14%,var(--line));border-radius:11px;background:color-mix(in srgb,var(--surface) 80%,transparent)}.instagram-secondary span,.instagram-secondary strong{display:block}.instagram-secondary span{color:var(--muted);font-size:.62rem}.instagram-secondary strong{margin-top:4px;font-size:.88rem;font-variant-numeric:tabular-nums}.data-note{margin-top:12px;color:var(--muted);font-size:.68rem;line-height:1.45}.format-chart{display:flex;flex-direction:column;gap:14px}.format-row{display:grid;grid-template-columns:110px minmax(100px,1fr) 90px;gap:13px}.format-label,.format-result{display:flex;flex-direction:column}.format-label strong,.format-result strong{font-size:.78rem}.format-label span,.format-result span{margin-top:2px;color:var(--muted);font-size:.62rem}.format-result{text-align:right}.format-bar span{background:linear-gradient(90deg,var(--accent),var(--sky))}.deadline-panel .panel-head>strong{color:var(--green);font-size:1.25rem}.deadline-panel .panel-head>strong.danger{color:var(--red)}.deadline-list{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.deadline-list>div{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border-radius:10px;background:var(--red-soft);color:var(--red);font-size:.72rem}.deadline-list>div.clear{background:var(--green-soft);color:var(--green)}.deadline-list span{display:flex;align-items:center;gap:5px}.punctuality{margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}.punctuality>div:first-child{display:flex;justify-content:space-between;margin-bottom:7px;font-size:.72rem}.punctuality small{display:block;margin-top:7px;color:var(--muted);font-size:.65rem}.top-content-panel{padding-bottom:8px}.publication-list{display:flex;flex-direction:column}.publication-row{display:grid;grid-template-columns:34px minmax(180px,1fr) repeat(3,90px) 34px;gap:12px;padding:12px 0;border-top:1px solid var(--line)}.rank{color:var(--muted);font-size:.68rem;font-weight:800}.publication-title,.publication-metric{display:flex;min-width:0;flex-direction:column}.publication-title strong{overflow:hidden;font-size:.78rem;text-overflow:ellipsis;white-space:nowrap}.publication-title span,.publication-metric span{margin-top:3px;color:var(--muted);font-size:.61rem}.publication-metric strong{font-size:.77rem;font-variant-numeric:tabular-nums}.publication-link{display:grid;width:30px;height:30px;place-items:center;border-radius:9px;background:var(--violet-soft);color:var(--violet)}.operations-heading{margin-top:22px}.operations-grid{display:grid;grid-template-columns:minmax(320px,.75fr) minmax(0,1.25fr);gap:14px}.status-stack{display:flex;height:12px;overflow:hidden;border-radius:99px;background:var(--line)}.status-stack span{min-width:2px}.task-bars{margin:14px 0}.task-row{display:grid;grid-template-columns:120px minmax(80px,1fr) 24px;gap:10px;padding:6px 0}.task-row>span{display:flex;align-items:center;gap:7px;font-size:.7rem}.task-row i{width:7px;height:7px;border-radius:50%}.task-row strong{text-align:right;font-size:.72rem}.task-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding-top:13px;border-top:1px solid var(--line)}.task-facts span{display:flex;flex-direction:column;color:var(--muted);font-size:.62rem}.task-facts strong{margin-bottom:3px;color:var(--ink);font-size:.82rem}.team-list{display:flex;max-height:390px;flex-direction:column;overflow-y:auto}.team-row{display:grid;grid-template-columns:10px minmax(130px,1fr) minmax(80px,1fr) 65px minmax(100px,auto);gap:10px;padding:11px 0;border-top:1px solid var(--line)}.person-dot{width:9px;height:9px;border-radius:50%}.person-main,.person-rate,.person-flags{display:flex;min-width:0;flex-direction:column}.person-main strong{overflow:hidden;font-size:.75rem;text-overflow:ellipsis;white-space:nowrap}.person-main span,.person-rate span{margin-top:2px;color:var(--muted);font-size:.61rem}.person-rate strong{font-size:.78rem}.person-rate.positive{color:var(--green)}.person-rate.warning{color:var(--amber)}.person-rate.negative{color:var(--red)}.person-rate.neutral{color:var(--muted)}.person-flags{gap:3px;font-size:.62rem}.positive{color:var(--green)}.negative{color:var(--red)}.team-meter span{background:linear-gradient(90deg,var(--accent),var(--sky))}.empty-panel{display:flex;min-height:190px;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:var(--muted);text-align:center}.empty-panel strong{color:var(--ink);font-size:.82rem}.empty-panel span{max-width:280px;font-size:.68rem;line-height:1.45}.empty-panel.compact{min-height:110px}
.score-ring{position:relative}
@media(hover:hover) and (pointer:fine){.publication-row{transition:background-color 140ms ease}.publication-row:hover{background:var(--sunken)}}
@media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(3,1fr)}.content-dashboard,.analytics-grid,.operations-grid{grid-template-columns:1fr}.team-row{grid-template-columns:10px minmax(140px,1fr) minmax(100px,1fr) 65px minmax(100px,auto)}}
@media(max-width:720px){.report-header{align-items:flex-start;flex-direction:column}.report-actions{width:100%}.period-control{flex:1}.period-control .select{width:100%}.executive{grid-template-columns:1fr;padding:20px}.score-block{display:flex;align-items:center;gap:12px;text-align:left}.score-ring{width:94px;height:94px}.score-ring:before{width:72px;height:72px}.score-ring strong{font-size:1.2rem}.kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi{padding:13px}.kpi:last-child{grid-column:1/-1}.funnel-stage{grid-template-columns:105px minmax(60px,1fr);gap:8px}.funnel-stage small{display:none}.deadline-list{grid-template-columns:1fr}.publication-row{grid-template-columns:28px minmax(140px,1fr) 74px 30px}.publication-metric:nth-of-type(3),.publication-metric:nth-of-type(4){display:none}.team-row{grid-template-columns:10px minmax(110px,1fr) 55px}.team-meter,.person-flags{display:none}.panel{padding:16px}.period-line{align-items:flex-start;flex-direction:column;gap:3px}.period-line span+span:before{display:none}.project-meta{align-items:flex-start;flex-direction:column;gap:5px}.instagram-primary strong{font-size:1.65rem}.task-facts{grid-template-columns:1fr 1fr}.format-row{grid-template-columns:88px minmax(70px,1fr) 75px}}
@media(max-width:420px){.report-actions{align-items:stretch;flex-direction:column}.export-button{width:100%}.kpi-grid{grid-template-columns:1fr 1fr}.instagram-secondary{grid-template-columns:1fr}.format-row{grid-template-columns:78px minmax(60px,1fr) 68px}.task-row{grid-template-columns:105px minmax(60px,1fr) 20px}}
</style>
