<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toasts'
import AppIcon from '../components/AppIcon.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  CONTENT_FORMAT, CONTENT_STATUS, EXPENSE_STATUS, PRIORITY, allowCompactDateKey,
  allowSumKey, compactDateTime, fmtDate, formatSum, maskCompactDateTime, maskSum, parseSum,
} from '../labels'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toasts = useToastStore()

const items = ref(null)
const myExpenses = ref(null)
const loading = ref(false)
const filterStatus = ref('')
const filterFormat = ref('')
const search = ref('')

const detail = ref(null)
const detailModal = ref(false)
const detailSaving = ref(false)
const detailSyncing = ref(false)
const detailError = ref('')
const detailForm = reactive({
  title: '', format: 'post', description: '', shooting_date: '', editing_deadline: '',
  publish_date: '', status: 'idea', comments: '', publication_url: '',
})

const expenseModal = ref(false)
const expenseItem = ref(null)
const expenseSaving = ref(false)
const expenseError = ref('')
const expenseForm = reactive({ purpose: '', amount: '' })

const selectedBrandId = computed(() => route.params.brandId ? Number(route.params.brandId) : null)
const isBrandPage = computed(() => selectedBrandId.value !== null)

const brands = computed(() => {
  const groups = new Map()
  for (const item of items.value || []) {
    if (!groups.has(item.brand)) {
      groups.set(item.brand, {
        id: item.brand,
        name: item.brand_name,
        total: 0,
        active: 0,
        overdue: 0,
        nextDate: null,
      })
    }
    const group = groups.get(item.brand)
    group.total += 1
    if (item.status !== 'published') group.active += 1
    const dates = [item.shooting_date, item.editing_deadline, item.publish_date]
      .filter(Boolean).map((value) => new Date(value)).filter((date) => !Number.isNaN(date.getTime()))
    for (const date of dates) {
      if (date < new Date() && item.status !== 'published') group.overdue += 1
      if (date >= new Date() && (!group.nextDate || date < group.nextDate)) group.nextDate = date
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const currentBrand = computed(() => brands.value.find((brand) => brand.id === selectedBrandId.value))
const brandItems = computed(() => (items.value || []).filter((item) => item.brand === selectedBrandId.value))
const filteredItems = computed(() => {
  const query = search.value.trim().toLowerCase()
  return brandItems.value.filter((item) => {
    if (filterStatus.value && item.status !== filterStatus.value) return false
    if (filterFormat.value && item.format !== filterFormat.value) return false
    return !query || item.title.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query)
  })
})

async function load() {
  loading.value = true
  try {
    if (!auth.user) await auth.fetchMe()
    const requests = [api.get('/content/')]
    if (isBrandPage.value) {
      requests.push(api.get('/expenses/', {
        params: { brand: selectedBrandId.value, created_by: auth.user.id },
      }))
    }
    const [contentResponse, expenseResponse] = await Promise.all(requests)
    items.value = contentResponse.data
    myExpenses.value = expenseResponse?.data || null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.brandId, () => {
  filterStatus.value = ''
  filterFormat.value = ''
  search.value = ''
  load()
})

async function setStatus(item, status) {
  const previous = item.status
  item.status = status
  try {
    const { data } = await api.patch(`/content/${item.id}/`, { status })
    Object.assign(item, data)
  } catch (error) {
    item.status = previous
    toasts.push(error.response?.data?.publication_url?.[0] || 'Не удалось изменить статус.', 'danger')
    if (status === 'published') await openDetail(item)
  }
}

async function openDetail(item) {
  const { data } = await api.get(`/content/${item.id}/`)
  detail.value = data
  Object.assign(detailForm, {
    title: data.title,
    format: data.format,
    description: data.description || '',
    shooting_date: compactDateTime(data.shooting_date),
    editing_deadline: compactDateTime(data.editing_deadline),
    publish_date: compactDateTime(data.publish_date),
    status: data.status,
    comments: data.comments || '',
    publication_url: data.publication_url || '',
  })
  detailError.value = ''
  detailModal.value = true
}

async function refreshDetailMetrics() {
  if (!detail.value?.id || !detailForm.publication_url.trim()) return
  detailSyncing.value = true
  detailError.value = ''
  try {
    if (detailForm.publication_url.trim() !== detail.value.publication_url) {
      await api.patch(`/content/${detail.value.id}/`, {
        publication_url: detailForm.publication_url.trim(),
      })
    }
    const { data } = await api.post(`/content/${detail.value.id}/sync-insights/`)
    detail.value = data
    const index = items.value.findIndex((item) => item.id === data.id)
    if (index !== -1) items.value[index] = data
    toasts.push('Показатели Instagram обновлены.', 'success')
  } catch (error) {
    detailError.value = error.response?.data?.detail || 'Не удалось обновить показатели Instagram.'
  } finally {
    detailSyncing.value = false
  }
}

function maskedDate(field, event) {
  const value = maskCompactDateTime(event.target.value)
  detailForm[field] = value
  event.target.value = value
}

async function saveDetail() {
  if (!detailForm.title.trim()) {
    detailError.value = 'Укажите название контента.'
    return
  }
  detailSaving.value = true
  detailError.value = ''
  try {
    await api.patch(`/content/${detail.value.id}/`, {
      title: detailForm.title.trim(),
      format: detailForm.format,
      description: detailForm.description.trim(),
      shooting_date: detailForm.shooting_date || null,
      editing_deadline: detailForm.editing_deadline || null,
      publish_date: detailForm.publish_date || null,
      status: detailForm.status,
      comments: detailForm.comments.trim(),
      publication_url: detailForm.publication_url.trim(),
    })
    detailModal.value = false
    toasts.push('Данные контент-плана сохранены.', 'success')
    await load()
  } catch (error) {
    detailError.value = error.response?.data?.detail
      || Object.values(error.response?.data || {})?.flat()?.[0]
      || 'Не удалось сохранить изменения.'
  } finally {
    detailSaving.value = false
  }
}

function openExpense(item) {
  expenseItem.value = item
  Object.assign(expenseForm, { purpose: '', amount: '' })
  expenseError.value = ''
  expenseModal.value = true
}

function updateExpenseAmount(event) {
  expenseForm.amount = maskSum(event.target.value)
}

async function saveExpense() {
  const amount = parseSum(expenseForm.amount)
  if (!expenseForm.purpose.trim() || amount < 1) {
    expenseError.value = 'Укажите, для чего потрачены деньги, и сумму.'
    return
  }
  expenseSaving.value = true
  expenseError.value = ''
  try {
    await api.post('/expenses/', {
      brand: expenseItem.value.brand,
      content_item: expenseItem.value.id,
      purpose: expenseForm.purpose.trim(),
      amount,
    })
    expenseModal.value = false
    toasts.push('Расход отправлен на согласование.', 'success')
    await load()
  } catch (error) {
    expenseError.value = error.response?.data?.detail
      || Object.values(error.response?.data || {})?.flat()?.[0]
      || 'Не удалось добавить расход.'
  } finally {
    expenseSaving.value = false
  }
}
</script>

<template>
  <div class="my-content-page">
    <template v-if="!isBrandPage">
      <div class="page-head">
        <div><h1 class="page-title">Мои бренды</h1><p>Выберите бренд, чтобы открыть назначенный вам контент-план.</p></div>
        <span v-if="items" class="brand-total">{{ brands.length }}</span>
      </div>

      <div v-if="!items || loading" class="brand-grid">
        <div v-for="index in 4" :key="index" class="skeleton" style="height: 150px" />
      </div>
      <div v-else-if="brands.length" class="brand-grid">
        <button v-for="brand in brands" :key="brand.id" type="button" class="card brand-card" @click="router.push(`/my-content/${brand.id}`)">
          <span class="brand-icon"><AppIcon name="campaign" :size="22" /></span>
          <div class="brand-main"><strong>{{ brand.name }}</strong><span>{{ brand.active }} активных из {{ brand.total }}</span></div>
          <span v-if="brand.overdue" class="overdue-count">{{ brand.overdue }} просрочено</span>
          <span v-else class="next-date">{{ brand.nextDate ? `Ближайший срок: ${fmtDate(brand.nextDate, true)}` : 'Нет ближайших сроков' }}</span>
          <AppIcon class="brand-arrow" name="chevron-down" :size="20" />
        </button>
      </div>
      <div v-else class="card empty-state"><AppIcon name="movie" :size="28" /><strong>Контент пока не назначен</strong><span>Когда менеджер выберет вас ответственным, бренд появится здесь.</span></div>
    </template>

    <template v-else>
      <button type="button" class="back" @click="router.push('/my-content')"><AppIcon name="chevron-down" :size="17" /> Мои бренды</button>
      <div class="detail-head">
        <div><h1 class="page-title">{{ currentBrand?.name || 'Контент-план' }}</h1><p>Ваши материалы, сроки и расходы по бренду</p></div>
        <span class="item-total">{{ brandItems.length }}</span>
      </div>

      <section class="card filters-card">
        <div class="filters">
          <label class="search-field"><AppIcon name="review" :size="16" /><input v-model="search" class="input" placeholder="Поиск по контенту" /></label>
          <select v-model="filterStatus" class="select"><option value="">Все статусы</option><option v-for="(value, key) in CONTENT_STATUS" :key="key" :value="key">{{ value.label }}</option></select>
          <select v-model="filterFormat" class="select"><option value="">Все форматы</option><option v-for="(label, key) in CONTENT_FORMAT" :key="key" :value="key">{{ label }}</option></select>
        </div>
      </section>

      <div v-if="!items || loading" class="skeleton" style="height: 250px" />
      <template v-else>
        <div class="card desktop-table content-table">
          <table><thead><tr><th>Контент</th><th>Формат</th><th>Съёмка</th><th>Монтаж</th><th>Публикация</th><th>Приоритет</th><th>Статус</th><th>Результат</th><th>Расход</th></tr></thead><tbody>
            <tr v-for="item in filteredItems" :key="item.id" class="content-row" @click="openDetail(item)">
              <td class="title-cell"><strong>{{ item.title }}</strong><span>{{ item.description || 'Описание не добавлено' }}</span></td>
              <td>{{ CONTENT_FORMAT[item.format] }}</td><td>{{ fmtDate(item.shooting_date, true) }}</td><td>{{ fmtDate(item.editing_deadline, true) }}</td><td>{{ fmtDate(item.publish_date, true) }}</td><td><StatusBadge :map="PRIORITY" :value="item.priority" /></td>
              <td><select class="status-select" :value="item.status" :style="{ color: CONTENT_STATUS[item.status]?.color, background: CONTENT_STATUS[item.status]?.bg }" @click.stop @change="setStatus(item, $event.target.value)"><option v-for="(value, key) in CONTENT_STATUS" :key="key" :value="key">{{ value.label }}</option></select></td>
              <td><a v-if="item.publication_url" :href="item.publication_url" class="metric-link" target="_blank" rel="noopener" @click.stop><AppIcon name="instagram" :size="15" /> {{ Number(item.metric_views || 0).toLocaleString('ru-RU') }}</a><span v-else class="muted">—</span></td>
              <td><button class="expense-btn" title="Добавить расход" @click.stop="openExpense(item)"><AppIcon name="wallet" :size="16" /> Добавить</button></td>
            </tr>
            <tr v-if="!filteredItems.length"><td colspan="9" class="empty">По выбранным фильтрам контент не найден</td></tr>
          </tbody></table>
        </div>

        <div class="mobile-content-list">
          <article v-for="item in filteredItems" :key="item.id" class="card mobile-content-card" @click="openDetail(item)">
            <div class="mobile-card-head"><div><strong>{{ item.title }}</strong><span>{{ CONTENT_FORMAT[item.format] }}</span></div><StatusBadge :map="PRIORITY" :value="item.priority" /></div>
            <div class="mobile-dates"><span><small>Съёмка</small>{{ fmtDate(item.shooting_date, true) }}</span><span><small>Монтаж</small>{{ fmtDate(item.editing_deadline, true) }}</span><span><small>Публикация</small>{{ fmtDate(item.publish_date, true) }}</span></div>
            <div class="mobile-card-actions"><select class="status-select" :value="item.status" :style="{ color: CONTENT_STATUS[item.status]?.color, background: CONTENT_STATUS[item.status]?.bg }" @click.stop @change="setStatus(item, $event.target.value)"><option v-for="(value, key) in CONTENT_STATUS" :key="key" :value="key">{{ value.label }}</option></select><button class="expense-btn" @click.stop="openExpense(item)"><AppIcon name="wallet" :size="16" /> Расход</button></div>
            <a v-if="item.publication_url" class="mobile-result" :href="item.publication_url" target="_blank" rel="noopener" @click.stop><AppIcon name="instagram" :size="16" /><span>Просмотры {{ Number(item.metric_views || 0).toLocaleString('ru-RU') }}</span><span>Лайки {{ Number(item.metric_likes || 0).toLocaleString('ru-RU') }}</span></a>
          </article>
          <div v-if="!filteredItems.length" class="card empty">По выбранным фильтрам контент не найден</div>
        </div>
      </template>

      <section class="expense-history">
        <div class="section-head"><div><h2>Мои расходы</h2><p>Запросы, отправленные вами по контенту этого бренда.</p></div><span v-if="myExpenses">{{ myExpenses.length }}</span></div>
        <div v-if="myExpenses === null || loading" class="skeleton" style="height: 140px" />
        <div v-else class="card desktop-table">
          <table><thead><tr><th>Дата</th><th>Контент</th><th>Для чего</th><th>Сумма</th><th>Статус</th></tr></thead><tbody><tr v-for="expense in myExpenses" :key="expense.id"><td>{{ fmtDate(expense.expense_date) }}</td><td>{{ expense.content_title }}</td><td class="expense-purpose" :title="expense.purpose">{{ expense.purpose }}</td><td class="expense-amount">{{ formatSum(expense.amount) }}</td><td><StatusBadge :map="EXPENSE_STATUS" :value="expense.status" /></td></tr><tr v-if="!myExpenses.length"><td colspan="5" class="empty">Вы ещё не отправляли расходы по этому бренду</td></tr></tbody></table>
        </div>
        <div v-if="myExpenses !== null && !loading" class="mobile-expense-list"><article v-for="expense in myExpenses" :key="expense.id" class="card mobile-expense-card"><div><strong>{{ expense.content_title }}</strong><StatusBadge :map="EXPENSE_STATUS" :value="expense.status" /></div><p>{{ expense.purpose }}</p><footer><span>{{ fmtDate(expense.expense_date) }}</span><strong>{{ formatSum(expense.amount) }}</strong></footer></article><div v-if="!myExpenses.length" class="card empty">Расходов пока нет</div></div>
      </section>
    </template>

    <AppModal :open="detailModal" title="Детали контент-плана" width="760px" @close="detailModal = false">
      <div class="detail-form">
        <div class="form-grid"><div class="span-2"><label class="field">Название *</label><input v-model="detailForm.title" class="input" /></div><div><label class="field">Формат</label><select v-model="detailForm.format" class="select"><option v-for="(label, key) in CONTENT_FORMAT" :key="key" :value="key">{{ label }}</option></select></div><div><label class="field">Статус</label><select v-model="detailForm.status" class="select"><option v-for="(value, key) in CONTENT_STATUS" :key="key" :value="key">{{ value.label }}</option></select></div></div>
        <div><label class="field">Подробное описание и сценарий</label><textarea v-model="detailForm.description" class="textarea description-editor" rows="9" placeholder="Кадр 1: ...&#10;Кадр 2: ...&#10;Текст, реквизит и требования к съёмке..." /></div>
        <div class="date-grid"><div><label class="field">Съёмка</label><input class="input" inputmode="numeric" maxlength="11" placeholder="ДД.ММ ЧЧ:ММ" :value="detailForm.shooting_date" @keydown="allowCompactDateKey" @input="maskedDate('shooting_date', $event)" /></div><div><label class="field">Монтаж</label><input class="input" inputmode="numeric" maxlength="11" placeholder="ДД.ММ ЧЧ:ММ" :value="detailForm.editing_deadline" @keydown="allowCompactDateKey" @input="maskedDate('editing_deadline', $event)" /></div><div><label class="field">Публикация</label><input class="input" inputmode="numeric" maxlength="11" placeholder="ДД.ММ ЧЧ:ММ" :value="detailForm.publish_date" @keydown="allowCompactDateKey" @input="maskedDate('publish_date', $event)" /></div></div>
        <div><label class="field">Рабочие комментарии</label><textarea v-model="detailForm.comments" class="textarea" rows="4" placeholder="Что подготовить, уточнить или согласовать" /></div>
        <section v-if="detailForm.status === 'published' || detailForm.publication_url" class="employee-publication"><div><AppIcon name="instagram" :size="19" /><strong>Результат публикации</strong></div><label class="field">Ссылка на опубликованный Reels или Post</label><input v-model="detailForm.publication_url" type="url" class="input" placeholder="https://www.instagram.com/reel/..." /><div v-if="detail?.metrics_last_synced_at" class="employee-metrics"><span>Просмотры <strong>{{ Number(detail.metric_views || 0).toLocaleString('ru-RU') }}</strong></span><span>Лайки <strong>{{ Number(detail.metric_likes || 0).toLocaleString('ru-RU') }}</strong></span><span>Комментарии <strong>{{ Number(detail.metric_comments || 0).toLocaleString('ru-RU') }}</strong></span></div><button v-if="detailForm.publication_url" type="button" class="btn outline sm employee-sync" :disabled="detailSyncing" @click="refreshDetailMetrics"><AppIcon name="review" :size="15" /> {{ detailSyncing ? 'Обновляем…' : 'Обновить показатели' }}</button></section>
        <p v-if="detailError" class="form-error">{{ detailError }}</p>
      </div>
      <template #footer><button class="btn outline" @click="detailModal = false">Отмена</button><button class="btn" :disabled="detailSaving" @click="saveDetail">{{ detailSaving ? 'Сохраняем…' : 'Сохранить изменения' }}</button></template>
    </AppModal>

    <AppModal :open="expenseModal" title="Расход по контенту" width="520px" @close="expenseModal = false">
      <div class="expense-form"><div class="expense-context"><AppIcon name="movie" :size="18" /><div><strong>{{ expenseItem?.title }}</strong><span>{{ expenseItem?.brand_name }}</span></div></div><div><label class="field">Для чего потрачено *</label><textarea v-model="expenseForm.purpose" class="textarea" rows="4" placeholder="Подробно опишите расход" /></div><div><label class="field">Сумма *</label><div class="sum-field"><input :value="expenseForm.amount" inputmode="numeric" class="input amount-input" placeholder="00.000.000" @keydown="allowSumKey" @input="updateExpenseAmount" /><span>сум</span></div></div><p v-if="expenseError" class="form-error">{{ expenseError }}</p></div>
      <template #footer><button class="btn outline" @click="expenseModal = false">Отмена</button><button class="btn" :disabled="expenseSaving" @click="saveExpense">{{ expenseSaving ? 'Отправляем…' : 'Отправить расход' }}</button></template>
    </AppModal>
  </div>
</template>

<style scoped>
.my-content-page{min-width:0}.page-head,.detail-head,.section-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.page-head{margin-bottom:18px}.page-head p,.detail-head p,.section-head p{margin-top:3px;color:var(--muted);font-size:.82rem}.brand-total,.item-total,.section-head>span{display:grid;min-width:31px;height:31px;place-items:center;border-radius:99px;background:var(--accent-soft);color:var(--accent);font-size:.78rem;font-weight:750}.brand-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.brand-card{position:relative;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;min-width:0;padding:16px;border:1px solid var(--line);color:var(--ink);font:inherit;text-align:left;cursor:pointer;transition:transform 140ms var(--ease-out),border-color 140ms ease,box-shadow 140ms ease}.brand-card:active{transform:scale(.98)}.brand-icon{display:grid;width:42px;height:42px;place-items:center;border-radius:12px;background:var(--accent-soft);color:var(--accent)}.brand-main{min-width:0}.brand-main strong,.brand-main span{display:block}.brand-main strong{overflow:hidden;font-size:1rem;text-overflow:ellipsis;white-space:nowrap}.brand-main span,.next-date{margin-top:3px;color:var(--muted);font-size:.75rem}.overdue-count,.next-date{grid-column:2/4}.overdue-count{color:var(--red);font-size:.75rem;font-weight:700}.brand-arrow{grid-column:3;grid-row:1;transform:rotate(-90deg);color:var(--muted)}.empty-state{display:flex;min-height:220px;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:var(--muted);text-align:center}.empty-state strong{color:var(--ink)}.back{display:inline-flex;align-items:center;gap:5px;margin-bottom:10px;padding:5px 0;border:0;background:transparent;color:var(--accent);font:inherit;font-size:.82rem;font-weight:700;cursor:pointer}.back .app-icon{transform:rotate(90deg)}.detail-head{margin-bottom:14px}.filters-card{padding:10px;margin-bottom:12px}.filters{display:grid;grid-template-columns:minmax(220px,1fr) 190px 160px;align-items:center;gap:8px}.search-field{position:relative;display:block}.search-field .app-icon{position:absolute;top:50%;left:12px;color:var(--muted);transform:translateY(-50%)}.search-field .input{width:100%;padding-left:38px}.desktop-table{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.82rem}th{padding:11px 12px;border-bottom:1px solid var(--line);color:var(--muted);font-size:.68rem;text-align:left;text-transform:uppercase;white-space:nowrap}td{padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap}tbody tr:last-child td{border-bottom:0}.content-row{cursor:pointer;transition:background-color 140ms ease}.title-cell{min-width:220px;max-width:300px}.title-cell strong,.title-cell span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title-cell span{margin-top:3px;color:var(--muted);font-size:.72rem}.status-select{max-width:145px;padding:6px 9px;border:0;border-radius:9px;font:inherit;font-size:.76rem;font-weight:650;cursor:pointer}.expense-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--accent);font:inherit;font-size:.76rem;font-weight:650;cursor:pointer;transition:transform 140ms var(--ease-out),border-color 140ms ease}.expense-btn:active{transform:scale(.96)}.empty{padding:28px!important;color:var(--muted);text-align:center}.mobile-content-list,.mobile-expense-list{display:none}.expense-history{margin-top:22px}.section-head{margin-bottom:10px}.section-head h2{font-size:1.02rem}.expense-purpose{max-width:320px;overflow:hidden;text-overflow:ellipsis}.expense-amount{color:var(--red);font-weight:750}.detail-form,.expense-form{display:flex;flex-direction:column;gap:14px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.span-2{grid-column:1/-1}.date-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.description-editor{min-height:190px;line-height:1.55;resize:vertical}.expense-context{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;background:var(--accent-soft);color:var(--accent)}.expense-context strong,.expense-context span{display:block}.expense-context span{margin-top:2px;font-size:.75rem}.sum-field{position:relative}.sum-field .input{padding-right:48px}.sum-field>span{position:absolute;top:50%;right:14px;color:var(--muted);font-size:.85rem;transform:translateY(-50%)}.amount-input{font-weight:700;font-variant-numeric:tabular-nums}.form-error{padding:9px 11px;border-radius:9px;background:var(--red-soft);color:var(--red);font-size:.8rem}
@media(hover:hover) and (pointer:fine){.brand-card:hover{border-color:var(--accent);box-shadow:var(--shadow-md);transform:translateY(-2px)}.content-row:hover{background:var(--sunken)}.expense-btn:hover{border-color:var(--accent)}}
@media(max-width:1000px){.brand-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{grid-template-columns:1fr 1fr}.search-field{grid-column:1/-1}}
@media(max-width:700px){.page-head,.detail-head{align-items:flex-start}.brand-grid{grid-template-columns:1fr}.brand-card{padding:14px}.filters-card{padding:9px}.filters{grid-template-columns:1fr}.search-field{grid-column:auto}.filters .input,.filters .select{width:100%;min-height:44px;font-size:16px}.desktop-table{display:none}.mobile-content-list,.mobile-expense-list{display:flex;flex-direction:column;gap:9px}.mobile-content-card{padding:13px;cursor:pointer}.mobile-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mobile-card-head>div{min-width:0}.mobile-card-head strong,.mobile-card-head span{display:block}.mobile-card-head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mobile-card-head span{margin-top:2px;color:var(--muted);font-size:.72rem}.mobile-dates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:12px 0}.mobile-dates>span{min-width:0;padding:8px;border-radius:9px;background:var(--sunken);font-size:.7rem;font-weight:650;white-space:nowrap}.mobile-dates small{display:block;margin-bottom:3px;color:var(--muted);font-size:.62rem}.mobile-card-actions{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.mobile-card-actions .status-select{width:100%;max-width:none;min-height:38px}.mobile-card-actions .expense-btn{min-height:38px}.section-head{align-items:flex-start}.mobile-expense-card{padding:13px}.mobile-expense-card>div,.mobile-expense-card footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.mobile-expense-card p{margin:10px 0;color:var(--ink-2);font-size:.82rem;line-height:1.45}.mobile-expense-card footer{padding-top:9px;border-top:1px solid var(--line);color:var(--muted);font-size:.75rem}.mobile-expense-card footer strong{color:var(--red);font-size:.82rem}.form-grid,.date-grid{grid-template-columns:1fr}.span-2{grid-column:auto}.detail-form .input,.detail-form .select,.detail-form .textarea,.expense-form .input,.expense-form .textarea{font-size:16px}.description-editor{min-height:230px}}
@media(max-width:390px){.mobile-dates{grid-template-columns:1fr}.mobile-dates>span{display:flex;justify-content:space-between}.mobile-dates small{margin:0}.mobile-card-actions{grid-template-columns:1fr}.expense-btn{width:100%}}
</style>

<!-- Page-specific polish: keep the employee workspace isolated from global CRM table/card rules. -->
<style scoped>
.my-content-page {
  width: 100%;
  max-width: 1480px;
  margin-inline: auto;
  padding-bottom: 24px;
}

.my-content-page .page-head,
.my-content-page .detail-head {
  min-width: 0;
}

.my-content-page .page-head > div,
.my-content-page .detail-head > div,
.my-content-page .section-head > div {
  min-width: 0;
}

.my-content-page .page-head p,
.my-content-page .detail-head p,
.my-content-page .section-head p {
  margin-bottom: 0;
  line-height: 1.45;
}

.my-content-page .brand-grid {
  grid-template-columns: repeat(auto-fill, minmax(280px, 360px));
  justify-content: start;
  gap: 16px;
}

.my-content-page .brand-card {
  appearance: none;
  width: 100%;
  min-height: 148px;
  grid-template-columns: 48px minmax(0, 1fr) 24px;
  grid-template-rows: auto auto;
  align-content: center;
  padding: 20px;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.my-content-page .brand-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
}

.my-content-page .brand-main strong {
  font-size: 1.02rem;
  line-height: 1.3;
}

.my-content-page .brand-main span,
.my-content-page .next-date,
.my-content-page .overdue-count {
  line-height: 1.35;
}

.my-content-page .overdue-count,
.my-content-page .next-date {
  grid-column: 2 / 3;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-content-page .brand-arrow {
  grid-column: 3;
  grid-row: 1 / 3;
  align-self: center;
}

.my-content-page .back {
  min-height: 36px;
  margin-bottom: 8px;
  border-radius: 9px;
}

.my-content-page .filters-card {
  padding: 12px;
  margin-bottom: 16px;
  overflow: visible;
  border-radius: 15px;
  background: var(--surface);
}

.my-content-page .filters {
  grid-template-columns: minmax(260px, 1fr) minmax(170px, 210px) minmax(150px, 180px);
  gap: 10px;
}

.my-content-page .filters .input,
.my-content-page .filters .select {
  width: 100%;
  min-width: 0;
  min-height: 42px;
}

.my-content-page .desktop-table {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  scrollbar-width: thin;
}

.my-content-page .content-table table {
  min-width: 1080px;
}

.my-content-page .desktop-table table {
  margin: 0;
}

.my-content-page .desktop-table th {
  height: 43px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--surface-solid) 55%, transparent);
  font-size: .66rem;
  letter-spacing: .035em;
  vertical-align: middle;
}

.my-content-page .desktop-table td {
  height: 58px;
  padding: 10px 14px;
  vertical-align: middle;
}

.my-content-page .title-cell {
  width: 30%;
  min-width: 260px;
  max-width: 360px;
}

.my-content-page .title-cell strong {
  color: var(--ink);
  font-size: .86rem;
  line-height: 1.35;
}

.my-content-page .title-cell span {
  max-width: 330px;
  line-height: 1.35;
}

.my-content-page .status-select {
  width: 145px;
  max-width: 145px;
  min-height: 36px;
  padding: 7px 30px 7px 10px;
  outline: none;
}

.my-content-page .status-select:focus-visible,
.my-content-page .expense-btn:focus-visible,
.my-content-page .employee-sync:focus-visible,
.my-content-page .brand-card:focus-visible,
.my-content-page .back:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.my-content-page .expense-btn {
  min-height: 36px;
  padding-inline: 11px;
  background: var(--surface-solid);
  white-space: nowrap;
}
.my-content-page .metric-link { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); font-size: .76rem; font-weight: 700; text-decoration: none; }
.my-content-page .mobile-result { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 9px 10px; border-radius: 10px; background: var(--violet-soft); color: var(--violet); font-size: .72rem; font-weight: 650; text-decoration: none; }
.my-content-page .mobile-result span:last-child { margin-left: auto; }
.my-content-page .employee-publication { display: flex; flex-direction: column; gap: 9px; padding: 13px; border: 1px solid var(--line); border-radius: 13px; background: var(--sunken); }
.my-content-page .employee-publication>div { display: flex; align-items: center; gap: 7px; color: var(--violet); }
.my-content-page .employee-publication p { color: var(--muted); font-size: .75rem; line-height: 1.5; }
.my-content-page .employee-metrics { display: grid!important; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 7px!important; color: var(--ink)!important; }
.my-content-page .employee-metrics span { display: flex; min-width: 0; flex-direction: column; gap: 3px; padding: 9px; border-radius: 9px; background: var(--surface); color: var(--muted); font-size: .7rem; }
.my-content-page .employee-metrics strong { overflow: hidden; color: var(--ink); font-size: .84rem; text-overflow: ellipsis; }
.my-content-page .employee-sync { align-self: flex-start; transition: transform 140ms var(--ease-out),border-color 140ms ease; }
.my-content-page .employee-sync:active { transform: scale(.97); }

.my-content-page .expense-history {
  margin-top: 28px;
}

.my-content-page .section-head {
  min-height: 42px;
  margin-bottom: 12px;
}

.my-content-page .expense-purpose {
  max-width: 420px;
}

.my-content-page .detail-form .input,
.my-content-page .detail-form .select,
.my-content-page .detail-form .textarea,
.my-content-page .expense-form .input,
.my-content-page .expense-form .textarea {
  width: 100%;
}

.my-content-page .description-editor {
  width: 100%;
  min-height: 220px;
}

@media (max-width: 1000px) {
  .my-content-page .filters {
    grid-template-columns: minmax(0, 1fr) minmax(170px, .55fr);
  }

  .my-content-page .search-field {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .my-content-page {
    padding-bottom: 16px;
  }

  .my-content-page .page-head,
  .my-content-page .detail-head,
  .my-content-page .section-head {
    gap: 10px;
  }

  .my-content-page .page-head h1,
  .my-content-page .detail-head h1 {
    overflow-wrap: anywhere;
  }

  .my-content-page .brand-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 11px;
  }

  .my-content-page .brand-card {
    min-height: 128px;
    grid-template-columns: 44px minmax(0, 1fr) 20px;
    padding: 16px;
    border-radius: 14px;
  }

  .my-content-page .brand-icon {
    width: 44px;
    height: 44px;
  }

  .my-content-page .filters-card {
    padding: 10px;
    margin-bottom: 12px;
  }

  .my-content-page .filters {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .my-content-page .search-field {
    grid-column: auto;
  }

  .my-content-page .desktop-table {
    display: none;
  }

  .my-content-page .mobile-content-list,
  .my-content-page .mobile-expense-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .my-content-page .mobile-content-card,
  .my-content-page .mobile-expense-card {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    padding: 15px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .my-content-page .employee-metrics { grid-template-columns: 1fr; }
  .my-content-page .employee-sync { width: 100%; min-height: 42px; }

  .my-content-page .mobile-card-head {
    min-width: 0;
  }

  .my-content-page .mobile-card-head > div {
    flex: 1;
  }

  .my-content-page .mobile-card-head strong {
    line-height: 1.35;
  }

  .my-content-page .mobile-dates {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .my-content-page .mobile-dates > span {
    overflow: hidden;
    padding: 9px 8px;
    text-overflow: ellipsis;
  }

  .my-content-page .mobile-card-actions {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .my-content-page .mobile-card-actions .status-select {
    width: 100%;
    max-width: none;
  }

  .my-content-page .expense-history {
    margin-top: 24px;
  }

  .my-content-page .section-head p {
    max-width: 280px;
  }

  .my-content-page .mobile-expense-card p {
    overflow-wrap: anywhere;
  }
}

@media (max-width: 480px) {
  .my-content-page .brand-total,
  .my-content-page .item-total,
  .my-content-page .section-head > span {
    flex: none;
  }

  .my-content-page .brand-card {
    gap: 10px;
  }

  .my-content-page .mobile-card-head {
    align-items: flex-start;
  }

  .my-content-page .mobile-dates {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .my-content-page .mobile-dates > span:last-child {
    grid-column: 1 / -1;
  }

  .my-content-page .mobile-card-actions {
    grid-template-columns: 1fr;
  }

  .my-content-page .mobile-card-actions .expense-btn {
    width: 100%;
  }

  .my-content-page .form-grid,
  .my-content-page .date-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .my-content-page .brand-card,
  .my-content-page .content-row,
  .my-content-page .expense-btn {
    transition: none;
  }
}
</style>
