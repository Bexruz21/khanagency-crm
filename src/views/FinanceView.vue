<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { downloadPdf } from '../api'
import FinanceTab from '../components/brand/FinanceTab.vue'
import AppIcon from '../components/AppIcon.vue'
import { formatSum } from '../labels'

const route = useRoute()
const router = useRouter()
const overview = ref(null)
const brand = ref(null)
const reportLoading = ref(false)
const isDetail = computed(() => !!route.params.brandId)
const cards = computed(() => {
  const value = overview.value?.summary || {}
  return [
    { label: 'Общая сумма договоров', value: value.budget, tone: 'accent' },
    { label: 'Получено от брендов', value: value.income, tone: 'green' },
    { label: 'На согласовании', value: value.submitted, tone: 'amber' },
    { label: 'Учтено расходов', value: value.expenses, tone: 'red' },
    { label: 'Общий баланс', value: value.balance, tone: value.balance < 0 ? 'red' : 'green' },
    { label: 'Осталось получить', value: value.receivable, tone: 'violet' },
  ]
})

async function loadOverview() {
  const { data } = await api.get('/expenses/overview/')
  overview.value = data
}

async function downloadOverviewReport() {
  reportLoading.value = true
  try {
    await downloadPdf('/expenses/report/', 'finance-overview.pdf')
  } finally {
    reportLoading.value = false
  }
}

watch(() => route.params.brandId, async (brandId) => {
  brand.value = null
  if (brandId) {
    const { data } = await api.get(`/brands/${brandId}/`)
    brand.value = data
  } else {
    await loadOverview()
  }
}, { immediate: true })
</script>

<template>
  <div v-if="isDetail">
    <button class="back" @click="router.push('/finances')"><AppIcon name="chevron-down" :size="17" /> Все финансы</button>
    <div v-if="!brand" class="skeleton" style="height: 220px" />
    <div v-else>
      <FinanceTab :key="brand.id" :brand="brand" />
    </div>
  </div>

  <div v-else class="overview">
    <div class="page-head">
      <div><h1 class="page-title">Финансы</h1><p>Общее финансовое состояние всех проектов</p></div>
      <button class="btn outline" :disabled="reportLoading" @click="downloadOverviewReport"><AppIcon name="review" :size="17" /> {{ reportLoading ? 'Готовим PDF…' : 'PDF-отчёт' }}</button>
    </div>

    <div v-if="!overview" class="skeleton" style="height: 120px" />
    <template v-else>
      <div class="summary-grid">
        <article v-for="card in cards" :key="card.label" class="card summary-card" :class="`tone-${card.tone}`"><span>{{ card.label }}</span><strong>{{ formatSum(card.value) }}</strong></article>
      </div>

      <section class="brands-section">
        <div class="section-head"><div><h2>Финансы по брендам</h2><p>Нажмите на бренд, чтобы открыть доходы, расходы и согласование.</p></div><span>{{ overview.brands.length }}</span></div>
        <div class="card table-wrap">
          <table><thead><tr><th>Бренд</th><th>Project Manager</th><th>Договор</th><th>Получено</th><th>На согласовании</th><th>Расходы</th><th>Баланс</th><th>Осталось получить</th></tr></thead><tbody>
            <tr v-for="item in overview.brands" :key="item.id" tabindex="0" @click="router.push(`/finances/${item.id}`)" @keydown.enter="router.push(`/finances/${item.id}`)"><td class="brand-name">{{ item.name }}</td><td>{{ item.manager }}</td><td>{{ formatSum(item.budget) }}</td><td class="positive">{{ formatSum(item.income) }}</td><td class="pending">{{ formatSum(item.submitted) }}</td><td class="negative">{{ formatSum(item.expenses) }}</td><td :class="item.balance < 0 ? 'negative' : 'positive'">{{ formatSum(item.balance) }}</td><td>{{ formatSum(item.receivable) }}</td></tr>
            <tr v-if="!overview.brands.length"><td colspan="8" class="empty">Финансовые данные по брендам пока отсутствуют</td></tr>
          </tbody></table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.overview { display: flex; flex-direction: column; gap: 16px; }.page-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.page-head .page-title{margin-bottom:3px}.page-head p{color:var(--muted);font-size:.85rem}.page-head .btn{flex:none;transition:transform 140ms var(--ease-out)}.page-head .btn:active{transform:scale(.97)}.back{display:inline-flex;align-items:center;gap:5px;margin-bottom:12px;padding:5px 0;border:0;background:transparent;color:var(--accent);font:inherit;font-size:.82rem;font-weight:650;cursor:pointer}.back .app-icon{transform:rotate(90deg)}
.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.summary-card{min-width:0;padding:16px;border-top:3px solid var(--tone)}.summary-card span{display:block;margin-bottom:7px;color:var(--muted);font-size:.72rem}.summary-card strong{display:block;overflow:hidden;font-size:1.08rem;font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap}.tone-accent{--tone:var(--accent)}.tone-green{--tone:var(--green)}.tone-amber{--tone:var(--amber)}.tone-red{--tone:var(--red)}.tone-violet{--tone:var(--violet)}
.brands-section{margin-top:4px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.section-head h2{font-size:1.02rem}.section-head p{margin-top:2px;color:var(--muted);font-size:.78rem}.section-head>span{display:grid;min-width:30px;height:30px;place-items:center;border-radius:99px;background:var(--accent-soft);color:var(--accent);font-size:.78rem;font-weight:750}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.82rem}th{padding:11px 12px;border-bottom:1px solid var(--line);color:var(--muted);font-size:.68rem;text-align:left;text-transform:uppercase;white-space:nowrap}td{padding:12px;border-bottom:1px solid var(--line);white-space:nowrap}tbody tr:not(:last-child){cursor:pointer;transition:background-color 140ms ease}tbody tr:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.brand-name{font-weight:750}.positive{color:var(--green);font-weight:650}.negative{color:var(--red);font-weight:650}.pending{color:var(--amber);font-weight:650}.empty{padding:30px!important;color:var(--muted);text-align:center}
@media(hover:hover) and (pointer:fine){tbody tr:not(:last-child):hover{background:var(--sunken)}}
@media(max-width:700px){.page-head{align-items:stretch;flex-direction:column}.page-head .btn{justify-content:center}.summary-grid{grid-template-columns:1fr 1fr}.section-head{align-items:flex-start}}
@media(max-width:440px){.summary-grid{grid-template-columns:1fr}}
</style>
