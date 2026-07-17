<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../api'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toasts'
import AppIcon from '../components/AppIcon.vue'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  CONTENT_FORMAT, CONTENT_STATUS, EXPENSE_CATEGORY, EXPENSE_STATUS, PRIORITY,
  allowSumKey, fmtDate, formatSum, maskSum, parseSum,
} from '../labels'

const items = ref(null)
const myExpenses = ref(null)
const filterStatus = ref('')
const toasts = useToastStore()
const auth = useAuthStore()
const expenseModal = ref(false)
const expenseItem = ref(null)
const expenseSaving = ref(false)
const expenseError = ref('')
const expenseForm = reactive({ category: 'other', purpose: '', amount: '' })

const filtered = computed(() =>
  !items.value ? [] : filterStatus.value
    ? items.value.filter((i) => i.status === filterStatus.value)
    : items.value
)

async function load() {
  const [contentResponse, expenseResponse] = await Promise.all([
    api.get('/content/'),
    api.get('/expenses/', { params: { created_by: auth.user.id } }),
  ])
  items.value = contentResponse.data
  myExpenses.value = expenseResponse.data
}
onMounted(load)

async function setStatus(item, status) {
  const prev = item.status
  item.status = status
  try {
    await api.patch(`/content/${item.id}/`, { status })
  } catch {
    item.status = prev
  }
}

function openExpense(item) {
  expenseItem.value = item
  Object.assign(expenseForm, { category: 'other', purpose: '', amount: '' })
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
      category: expenseForm.category,
      purpose: expenseForm.purpose.trim(),
      amount,
    })
    expenseModal.value = false
    toasts.push('Расход отправлен администратору на согласование.', 'success')
    const { data } = await api.get('/expenses/', { params: { created_by: auth.user.id } })
    myExpenses.value = data
  } catch (e) {
    expenseError.value = e.response?.data?.detail || Object.values(e.response?.data || {})?.flat()?.[0] || 'Не удалось добавить расход.'
  } finally {
    expenseSaving.value = false
  }
}
</script>

<template>
  <div>
    <div class="head">
      <h1 class="page-title" style="margin: 0">Мой контент-план</h1>
      <select v-model="filterStatus" class="select" style="width: 180px">
        <option value="">Все статусы</option>
        <option v-for="(v, k) in CONTENT_STATUS" :key="k" :value="k">{{ v.label }}</option>
      </select>
    </div>
    <p class="hint">Здесь контент, где вы ответственный. Вы двигаете его по статусам — остальное редактирует менеджер.</p>

    <div v-if="!items" class="skeleton" style="height: 240px" />

    <div v-else class="card table-wrap rise">
      <table>
        <thead>
          <tr>
            <th>Название</th><th>Бренд</th><th>Формат</th>
            <th>Съёмка</th><th>Монтаж</th><th>Публикация</th>
            <th>Приоритет</th><th>Статус</th><th>Расход</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filtered" :key="item.id">
            <td class="title-cell" :title="item.description">{{ item.title }}</td>
            <td>{{ item.brand_name }}</td>
            <td>{{ CONTENT_FORMAT[item.format] }}</td>
            <td>{{ fmtDate(item.shooting_date, true) }}</td>
            <td>{{ fmtDate(item.editing_deadline, true) }}</td>
            <td>{{ fmtDate(item.publish_date, true) }}</td>
            <td><StatusBadge :map="PRIORITY" :value="item.priority" /></td>
            <td>
              <select
                class="status-select" :value="item.status"
                :style="{ color: CONTENT_STATUS[item.status]?.color, background: CONTENT_STATUS[item.status]?.bg }"
                @change="setStatus(item, $event.target.value)"
              >
                <option v-for="(v, k) in CONTENT_STATUS" :key="k" :value="k">{{ v.label }}</option>
              </select>
            </td>
            <td><button class="expense-btn" title="Добавить расход" @click="openExpense(item)"><AppIcon name="wallet" :size="16" /> Добавить</button></td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="9" class="empty">Вам пока не назначен контент</td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="expense-history">
      <div class="section-head"><div><h2>Мои запросы на расходы</h2><p>Видны только заявки, отправленные вами по назначенному контенту.</p></div><span v-if="myExpenses" class="request-count">{{ myExpenses.length }}</span></div>
      <div v-if="!myExpenses" class="skeleton" style="height:140px" />
      <div v-else class="card table-wrap">
        <table><thead><tr><th>Дата</th><th>Проект</th><th>Контент</th><th>Для чего</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>
          <tr v-for="expense in myExpenses" :key="expense.id"><td>{{ fmtDate(expense.expense_date) }}</td><td>{{ expense.brand_name }}</td><td>{{ expense.content_title }}</td><td class="expense-purpose" :title="expense.purpose">{{ expense.purpose }}</td><td class="expense-amount">{{ formatSum(expense.amount) }}</td><td><StatusBadge :map="EXPENSE_STATUS" :value="expense.status" /></td></tr>
          <tr v-if="!myExpenses.length"><td colspan="6" class="empty">Вы ещё не отправляли запросы на расходы</td></tr>
        </tbody></table>
      </div>
    </section>

    <AppModal :open="expenseModal" title="Расход по контенту" width="520px" @close="expenseModal = false">
      <div class="expense-form">
        <div class="expense-context"><AppIcon name="movie" :size="18" /><div><strong>{{ expenseItem?.title }}</strong><span>{{ expenseItem?.brand_name }}</span></div></div>
        <div><label class="field">Категория</label><select v-model="expenseForm.category" class="select"><option v-for="(label, key) in EXPENSE_CATEGORY" :key="key" :value="key">{{ label }}</option></select></div>
        <div><label class="field">Для чего потрачено *</label><textarea v-model="expenseForm.purpose" class="textarea" rows="4" placeholder="Подробно опишите расход" /></div>
        <div><label class="field">Сумма *</label><div class="sum-field"><input :value="expenseForm.amount" inputmode="numeric" class="input amount-input" placeholder="00.000.000" @keydown="allowSumKey" @input="updateExpenseAmount" /><span>сум</span></div></div>
        <p v-if="expenseError" class="expense-error">{{ expenseError }}</p>
      </div>
      <template #footer><button class="btn outline" @click="expenseModal = false">Отмена</button><button class="btn" :disabled="expenseSaving" @click="saveExpense">{{ expenseSaving ? 'Отправляем…' : 'Отправить расход' }}</button></template>
    </AppModal>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 10px; }
.hint { color: var(--muted); font-size: 0.86rem; margin-bottom: 16px; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
th {
  text-align: left; font-size: 0.73rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted); padding: 12px 14px; border-bottom: 1px solid var(--line); white-space: nowrap;
}
td { padding: 11px 14px; border-bottom: 1px solid var(--line); white-space: nowrap; }
tbody tr:last-child td { border-bottom: 0; }
.title-cell { font-weight: 600; max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
.empty { text-align: center; color: var(--muted); padding: 28px !important; }

.status-select {
  border: 0; border-radius: 99px; padding: 4px 10px;
  font-size: 0.78rem; font-weight: 600; cursor: pointer; appearance: none; outline: none;
}
.expense-btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line); border-radius: 8px; padding: 6px 9px; background: var(--surface); color: var(--accent); font-weight: 650; cursor: pointer; }
.expense-form { display: flex; flex-direction: column; gap: 13px; }
.expense-context { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 11px; background: var(--accent-soft); color: var(--accent); }
.expense-context strong, .expense-context span { display: block; }
.expense-context strong { color: var(--ink); font-size: .88rem; } .expense-context span { margin-top: 2px; font-size: .75rem; }
.amount-input { font-weight: 650; font-variant-numeric: tabular-nums; }
.sum-field { position: relative; } .sum-field .input { padding-right: 48px; } .sum-field span { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .85rem; pointer-events: none; }
.expense-error { padding: 9px 11px; border-radius: 9px; background: var(--red-soft); color: var(--red); font-size: .8rem; }
.expense-history { margin-top: 24px; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.section-head h2 { font-size: 1.05rem; margin-bottom: 3px; }.section-head p { color: var(--muted); font-size: .8rem; }
.request-count { display: grid; place-items: center; min-width: 30px; height: 30px; padding-inline: 8px; border-radius: 99px; background: var(--accent-soft); color: var(--accent); font-weight: 750; font-size: .8rem; }
.expense-purpose { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }.expense-amount { color: var(--red); font-weight: 700; }

@media (max-width: 640px) {
  .head { align-items: stretch; flex-direction: column; }
  .head .select { width: 100% !important; }
  .table-wrap { margin-inline: -1px; border-radius: var(--radius); }
  th, td { padding-inline: 12px; }
  .status-select { min-height: 36px; }
}
</style>
