<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../../api'
import { useAuthStore } from '../../stores/auth'
import { useToastStore } from '../../stores/toasts'
import AppIcon from '../AppIcon.vue'
import AppModal from '../AppModal.vue'
import StatusBadge from '../StatusBadge.vue'
import { EXPENSE_CATEGORY, EXPENSE_STATUS, allowSumKey, fmtDate, formatSum, maskSum, parseSum } from '../../labels'

const props = defineProps({ brand: { type: Object, required: true } })
const auth = useAuthStore()
const toasts = useToastStore()
const expenses = ref(null)
const incomes = ref(null)
const summary = ref(null)
const contentItems = ref([])
const expenseAuthors = ref([])
const view = ref('expenses')
const modal = ref(false)
const formType = ref('expense')
const saving = ref(false)
const reportLoading = ref(false)
const error = ref('')
const filters = reactive({ date_from: '', date_to: '', category: '', status: '', created_by: '' })
const filtersOpen = ref(false)

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const form = reactive({ category: 'other', purpose: '', amount: '', date: today(), content_item: '' })
const cards = computed(() => [
  { label: 'Сумма договора', value: summary.value?.budget, tone: 'accent' },
  { label: 'Получено от бренда', value: summary.value?.income, tone: 'green' },
  { label: 'На согласовании', value: summary.value?.submitted, tone: 'amber' },
  { label: 'Учтено расходов', value: summary.value?.expenses, tone: 'red' },
  { label: 'Баланс проекта', value: summary.value?.balance, tone: summary.value?.balance < 0 ? 'red' : 'green' },
  { label: 'Осталось получить', value: summary.value?.receivable, tone: 'violet' },
])
const isAssignedManager = computed(() => auth.user?.role === 'pm'
  && Number(props.brand.manager) === Number(auth.user?.id))
const canManageExpenses = computed(() => auth.user?.role === 'admin' || isAssignedManager.value)
const canDeleteExpenses = computed(() => auth.user?.role === 'admin')
const activeFilterCount = computed(() => {
  const keys = view.value === 'expenses'
    ? ['date_from', 'date_to', 'category', 'status', 'created_by']
    : ['date_from', 'date_to']
  return keys.filter((key) => filters[key]).length
})

function params(extra = {}) {
  return Object.fromEntries(Object.entries({ brand: props.brand.id, ...filters, ...extra }).filter(([, value]) => value !== ''))
}

async function load() {
  const [expenseResponse, incomeResponse, summaryResponse, contentResponse] = await Promise.all([
    api.get('/expenses/', { params: params() }),
    api.get('/incomes/', { params: params({ category: '', status: '', created_by: '' }) }),
    api.get('/expenses/summary/', { params: params({ category: '', status: '', created_by: '' }) }),
    api.get('/content/', { params: { brand: props.brand.id } }),
  ])
  expenses.value = expenseResponse.data
  incomes.value = incomeResponse.data
  summary.value = summaryResponse.data
  contentItems.value = contentResponse.data
}

async function loadExpenseAuthors() {
  const { data } = await api.get('/expenses/', { params: { brand: props.brand.id } })
  const unique = new Map()
  for (const item of data) {
    if (item.created_by && item.created_by_detail) unique.set(item.created_by, item.created_by_detail)
  }
  expenseAuthors.value = [...unique.entries()].map(([id, user]) => ({ id, name: user.full_name || user.username }))
}
onMounted(() => Promise.all([load(), loadExpenseAuthors()]))

function resetFilters() {
  Object.assign(filters, { date_from: '', date_to: '', category: '', status: '', created_by: '' })
  filtersOpen.value = false
  load()
}

function openCreate(type) {
  formType.value = type
  Object.assign(form, { category: 'other', purpose: '', amount: '', date: today(), content_item: '' })
  error.value = ''
  modal.value = true
}

function updateAmount(event) { form.amount = maskSum(event.target.value) }

async function save() {
  const amount = parseSum(form.amount)
  if (amount < 1 || (formType.value === 'expense' && !form.purpose.trim())) {
    error.value = 'Укажите сумму и назначение расхода.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    if (formType.value === 'income') {
      await api.post('/incomes/', { brand: props.brand.id, amount, received_date: form.date, purpose: form.purpose.trim() })
      toasts.push('Доход добавлен в учёт проекта.', 'success')
    } else {
      await api.post('/expenses/', {
        brand: props.brand.id, content_item: form.content_item || null, category: form.category,
        purpose: form.purpose.trim(), amount, expense_date: form.date,
      })
      toasts.push('Расход отправлен на согласование.', 'success')
    }
    modal.value = false
    await load()
  } catch (e) {
    error.value = e.response?.data?.detail || Object.values(e.response?.data || {})?.flat()?.[0] || 'Не удалось сохранить запись.'
  } finally { saving.value = false }
}

async function setStatus(expense, status) {
  await api.patch(`/expenses/${expense.id}/`, { status })
  toasts.push(status === 'approved' ? 'Расход одобрен и учтён.' : 'Расход отклонён.', status === 'approved' ? 'success' : 'danger')
  await load()
}

async function removeRecord(type, record) {
  if (!window.confirm('Удалить финансовую запись?')) return
  await api.delete(`/${type}/${record.id}/`)
  await load()
}

async function downloadReport() {
  reportLoading.value = true
  try {
    const response = await api.get('/expenses/report/', { params: params(), responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `finance-${props.brand.name}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  } finally { reportLoading.value = false }
}
</script>

<template>
  <section class="finance">
    <div class="finance-topbar">
      <div class="finance-title">
        <h1 class="page-title">{{ brand.name }}</h1>
        <p>Финансовое управление брендом</p>
      </div>
      <div class="finance-actions">
        <button class="btn outline" :disabled="reportLoading" @click="downloadReport"><AppIcon name="review" :size="17" /> {{ reportLoading ? 'Готовим PDF…' : 'PDF-отчёт' }}</button>
        <button v-if="auth.user?.role === 'admin'" class="btn soft" @click="openCreate('income')"><AppIcon name="wallet" :size="17" /> Добавить доход</button>
        <button v-if="canManageExpenses" class="btn" @click="openCreate('expense')"><AppIcon name="campaign" :size="17" /> Добавить расход</button>
      </div>
    </div>

    <div v-if="!summary" class="skeleton" style="height: 106px" />
    <div v-else class="summary-grid">
      <article v-for="card in cards" :key="card.label" class="card summary-card" :class="`tone-${card.tone}`"><span>{{ card.label }}</span><strong>{{ formatSum(card.value) }}</strong></article>
    </div>

    <div v-if="!expenses || !incomes" class="skeleton" style="height: 250px" />
    <section v-else class="card operations-card">
      <div class="operations-toolbar">
        <div class="switcher"><button :class="{ active: view === 'expenses' }" @click="view = 'expenses'">Расходы</button><button :class="{ active: view === 'incomes' }" @click="view = 'incomes'">Доходы</button></div>
        <button class="btn outline sm filter-toggle" :class="{ active: filtersOpen }" @click="filtersOpen = !filtersOpen">
          <AppIcon name="filter" :size="15" /> Фильтры
          <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
        </button>
      </div>
      <div v-if="filtersOpen" class="compact-filters">
        <label class="filter-field"><span>Дата от</span><input v-model="filters.date_from" type="date" class="input" /></label>
        <label class="filter-field"><span>Дата до</span><input v-model="filters.date_to" type="date" class="input" /></label>
        <label v-if="view === 'expenses'" class="filter-field"><span>Категория</span><select v-model="filters.category" class="select"><option value="">Все категории</option><option v-for="(label, key) in EXPENSE_CATEGORY" :key="key" :value="key">{{ label }}</option></select></label>
        <label v-if="view === 'expenses'" class="filter-field"><span>Статус</span><select v-model="filters.status" class="select"><option value="">Все статусы</option><option v-for="(item, key) in EXPENSE_STATUS" :key="key" :value="key">{{ item.label }}</option></select></label>
        <label v-if="view === 'expenses'" class="filter-field"><span>Добавил</span><select v-model="filters.created_by" class="select"><option value="">Все авторы</option><option v-for="author in expenseAuthors" :key="author.id" :value="author.id">{{ author.name }}</option></select></label>
        <div class="filter-actions"><button class="btn sm" @click="load">Применить</button><button class="btn outline sm" @click="resetFilters">Сбросить</button></div>
      </div>
      <div class="table-wrap">
        <table v-if="view === 'expenses'">
        <thead><tr><th>Дата</th><th>Категория</th><th>Для чего</th><th>Контент</th><th>Добавил</th><th>Сумма</th><th>Статус</th><th v-if="canManageExpenses">Действия</th></tr></thead>
        <tbody>
          <tr v-for="expense in expenses" :key="expense.id">
            <td>{{ fmtDate(expense.expense_date) }}</td><td>{{ EXPENSE_CATEGORY[expense.category] }}</td><td class="purpose" :title="expense.purpose">{{ expense.purpose }}</td><td>{{ expense.content_title || 'Общий расход' }}</td><td>{{ expense.created_by_detail?.full_name || '—' }}</td><td class="amount negative">−{{ formatSum(expense.amount) }}</td><td><StatusBadge :map="EXPENSE_STATUS" :value="expense.status" /></td>
            <td v-if="canManageExpenses" class="actions"><div class="action-buttons"><button v-if="expense.status === 'submitted'" class="mini approve" title="Одобрить" @click="setStatus(expense, 'approved')"><AppIcon name="check" :size="16" /></button><button v-if="expense.status === 'submitted'" class="mini reject" title="Отклонить" @click="setStatus(expense, 'rejected')"><AppIcon name="close" :size="16" /></button><button v-if="canDeleteExpenses" class="mini" title="Удалить" @click="removeRecord('expenses', expense)"><AppIcon name="close" :size="16" /></button></div></td>
          </tr>
          <tr v-if="!expenses.length"><td :colspan="canManageExpenses ? 8 : 7" class="empty">Расходов по выбранным фильтрам нет</td></tr>
        </tbody>
      </table>
        <table v-else>
        <thead><tr><th>Дата</th><th>Назначение платежа</th><th>Добавил</th><th>Сумма</th><th v-if="auth.user?.role === 'admin'">Действия</th></tr></thead>
        <tbody><tr v-for="income in incomes" :key="income.id"><td>{{ fmtDate(income.received_date) }}</td><td class="purpose">{{ income.purpose || 'Оплата от бренда' }}</td><td>{{ income.created_by_detail?.full_name || '—' }}</td><td class="amount positive">+{{ formatSum(income.amount) }}</td><td v-if="auth.user?.role === 'admin'"><button class="mini" title="Удалить" @click="removeRecord('incomes', income)"><AppIcon name="close" :size="16" /></button></td></tr><tr v-if="!incomes.length"><td :colspan="auth.user?.role === 'admin' ? 5 : 4" class="empty">Доходов по выбранным фильтрам нет</td></tr></tbody>
        </table>
      </div>
    </section>

    <AppModal :open="modal" :title="formType === 'income' ? 'Новый доход' : 'Новый расход'" width="560px" @close="modal = false">
      <div class="form">
        <div class="row2"><div v-if="formType === 'expense'"><label class="field">Категория</label><select v-model="form.category" class="select"><option v-for="(label, key) in EXPENSE_CATEGORY" :key="key" :value="key">{{ label }}</option></select></div><div><label class="field">Дата</label><input v-model="form.date" type="date" class="input" /></div></div>
        <div v-if="formType === 'expense'"><label class="field">Запись контент-плана</label><select v-model="form.content_item" class="select"><option value="">Общий расход проекта</option><option v-for="item in contentItems" :key="item.id" :value="item.id">{{ item.title }}</option></select></div>
        <div><label class="field">{{ formType === 'income' ? 'За что поступила оплата' : 'Для чего потрачено *' }}</label><textarea v-model="form.purpose" class="textarea" rows="4" :placeholder="formType === 'income' ? 'Например: оплата за июль, первый транш 30%' : 'Например: аренда студии для трёх Reels'" /></div>
        <div><label class="field">Сумма *</label><div class="sum-field"><input :value="form.amount" inputmode="numeric" class="input amount-input" placeholder="00.000.000" @keydown="allowSumKey" @input="updateAmount" /><span>сум</span></div></div>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
      <template #footer><button class="btn outline" @click="modal = false">Отмена</button><button class="btn" :disabled="saving" @click="save">{{ saving ? 'Сохраняем…' : 'Сохранить' }}</button></template>
    </AppModal>
  </section>
</template>

<style scoped>
.finance { display: flex; min-width: 0; flex-direction: column; gap: 14px; }
.finance-topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px; }
.finance-title { min-width: 0; }
.finance-title .page-title { margin-bottom: 3px; }
.finance-title p { color: var(--muted); font-size: .85rem; }
.finance-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.finance-actions .btn { min-height: 38px; white-space: nowrap; transition: transform 140ms var(--ease-out); }
.finance-actions .btn:active, .switcher button:active, .filter-toggle:active { transform: scale(.97); }

.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.summary-card { min-width: 0; padding: 15px; border-top: 3px solid var(--tone); }
.summary-card span { display: block; margin-bottom: 7px; color: var(--muted); font-size: .72rem; }
.summary-card strong { display: block; overflow: hidden; font-size: 1.05rem; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.tone-accent { --tone: var(--accent); }.tone-amber { --tone: var(--amber); }.tone-green { --tone: var(--green); }.tone-red { --tone: var(--red); }.tone-violet { --tone: var(--violet); }

.operations-card { overflow: hidden; }
.operations-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
.switcher { display: grid; grid-template-columns: 1fr 1fr; min-width: 200px; padding: 3px; border-radius: 10px; background: var(--sunken); }
.switcher button { min-height: 34px; padding: 6px 14px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font: inherit; font-size: .8rem; font-weight: 650; cursor: pointer; transition: transform 140ms var(--ease-out), color 140ms ease, background-color 140ms ease; }
.switcher button.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
.filter-toggle { min-width: 104px; justify-content: center; }
.filter-toggle.active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.filter-count { display: grid; min-width: 18px; height: 18px; place-items: center; margin-left: 2px; border-radius: 99px; background: var(--accent); color: white; font-size: .65rem; font-weight: 750; }
.compact-filters { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)) auto; align-items: center; gap: 9px; padding: 10px 12px; border-bottom: 1px solid var(--line); background: var(--sunken); }
.filter-field { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.filter-field > span { color: var(--muted); font-size: .68rem; font-weight: 650; }
.filter-field .input, .filter-field .select { width: 100%; min-width: 0; }
.filter-actions { display: grid; grid-template-columns: repeat(2, max-content); align-items: center; gap: 7px; padding-top: 19px; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .84rem; }
th { padding: 11px 12px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: .7rem; text-align: left; text-transform: uppercase; white-space: nowrap; }
td { padding: 11px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
tbody tr:last-child td { border-bottom: 0; }
.purpose { max-width: 260px; overflow: hidden; font-weight: 600; text-overflow: ellipsis; }
.amount { font-weight: 750; font-variant-numeric: tabular-nums; }.positive { color: var(--green); }.negative { color: var(--red); }
.actions { min-width: 76px; }
.action-buttons { display: flex; min-height: 30px; align-items: center; gap: 5px; }
.mini { display: grid; width: 30px; height: 30px; place-items: center; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--muted); cursor: pointer; transition: transform 140ms var(--ease-out), border-color 140ms ease; }
.mini:active { transform: scale(.95); }.mini.approve { color: var(--green); }.mini.reject { color: var(--red); }
.empty { padding: 28px !important; color: var(--muted); text-align: center; }
.form { display: flex; flex-direction: column; gap: 13px; }.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.amount-input { font-weight: 650; font-variant-numeric: tabular-nums; }.sum-field { position: relative; }.sum-field .input { padding-right: 48px; }.sum-field span { position: absolute; top: 50%; right: 14px; color: var(--muted); font-size: .85rem; pointer-events: none; transform: translateY(-50%); }
.error { padding: 9px 11px; border-radius: 9px; background: var(--red-soft); color: var(--red); font-size: .8rem; }

@media (hover: hover) and (pointer: fine) { .mini:hover { border-color: currentColor; } }
@media (max-width: 1120px) {
  .compact-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }.filter-actions { grid-column: 1 / -1; grid-template-columns: 1fr 1fr; }.filter-actions .btn { justify-content: center; }
}
@media (max-width: 700px) {
  .finance-topbar { align-items: stretch; flex-direction: column; }.finance-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }.finance-actions .btn { min-width: 0; justify-content: center; padding-inline: 9px; font-size: .76rem; }
  .summary-grid { grid-template-columns: 1fr 1fr; }.operations-toolbar { align-items: stretch; flex-direction: column; }.switcher,.filter-toggle { width: 100%; }.compact-filters { grid-template-columns: 1fr; }.filter-actions { grid-column: auto; padding-top: 0; }
  .row2 { grid-template-columns: 1fr; }
}
@media (max-width: 440px) { .summary-grid { grid-template-columns: 1fr; }.finance-actions .app-icon { display: none; } }
</style>
