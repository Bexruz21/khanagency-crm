<script setup>
import { onMounted, reactive, ref } from 'vue'
import api from '../api'
import StatusBadge from '../components/StatusBadge.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { PRIORITY, fmtDate } from '../labels'

const items = ref(null)
const brands = ref([])
const assignees = ref([])
const loading = ref(false)
const filters = reactive({ date_from: '', date_to: '', brand: '', assignee: '' })

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    const { data } = await api.get(`/tasks/archive/?${params}`)
    items.value = data.items
    brands.value = data.brands
    assignees.value = data.assignees
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { date_from: '', date_to: '', brand: '', assignee: '' })
  load()
}

onMounted(load)
</script>

<template>
  <div class="archive-page">
    <div class="head">
      <div>
        <RouterLink to="/tasks" class="back">← Задачи</RouterLink>
        <h1 class="page-title">Архив выполненных задач</h1>
      </div>
    </div>

    <div class="card filters">
      <div>
        <label class="field">Дата от</label>
        <input v-model="filters.date_from" type="date" class="input" @change="load" />
      </div>
      <div>
        <label class="field">Дата до</label>
        <input v-model="filters.date_to" type="date" class="input" @change="load" />
      </div>
      <div>
        <label class="field">Бренд</label>
        <select v-model="filters.brand" class="select" @change="load">
          <option value="">Все бренды</option>
          <option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
        </select>
      </div>
      <div>
        <label class="field">Исполнитель</label>
        <select v-model="filters.assignee" class="select" @change="load">
          <option value="">Все исполнители</option>
          <option v-for="user in assignees" :key="user.id" :value="user.id">{{ user.full_name }}</option>
        </select>
      </div>
      <button class="btn outline reset" @click="resetFilters">Сбросить</button>
    </div>

    <div v-if="items === null || loading" class="skeleton" style="height: 260px" />

    <div v-else class="card table-wrap rise">
      <table>
        <thead>
          <tr>
            <th>Задача</th><th>Бренд</th><th>Исполнитель</th>
            <th>Дедлайн</th><th>Выполнено</th><th>Приоритет</th><th>Результат</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in items" :key="task.id">
            <td class="title-cell">{{ task.title }}</td>
            <td>{{ task.brand_name || '—' }}</td>
            <td>
              <div class="person">
                <UserAvatar :user="task.assignee_detail" :size="26" />
                <span>{{ task.assignee_detail?.full_name || '—' }}</span>
              </div>
            </td>
            <td>{{ fmtDate(task.deadline, true) }}</td>
            <td>{{ fmtDate(task.completed_at, true) }}</td>
            <td><StatusBadge :map="PRIORITY" :value="task.priority" /></td>
            <td :class="task.coins_result < 0 ? 'negative' : 'positive'">
              {{ task.coins_result ? Number(task.coins_result).toLocaleString('ru-RU') : '—' }}
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="7" class="empty">В архиве нет задач по выбранным фильтрам</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.archive-page { min-width: 0; }
.head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 16px; }
.back { display: inline-block; color: var(--accent); text-decoration: none; font-size: 0.86rem; font-weight: 600; margin-bottom: 5px; }
.page-title { margin: 0; }
.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(145px, 1fr)) auto;
  align-items: end;
  gap: 10px;
  padding: 14px;
  margin-bottom: 14px;
}
.reset { white-space: nowrap; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
th {
  text-align: left; color: var(--muted); font-size: 0.72rem; text-transform: uppercase;
  letter-spacing: 0.05em; padding: 12px 14px; border-bottom: 1px solid var(--line); white-space: nowrap;
}
td { padding: 12px 14px; border-bottom: 1px solid var(--line); white-space: nowrap; }
tbody tr:last-child td { border-bottom: 0; }
.title-cell { font-weight: 650; min-width: 220px; white-space: normal; }
.person { display: flex; align-items: center; gap: 8px; }
.positive { color: var(--green); font-weight: 650; }
.negative { color: var(--red); font-weight: 650; }
.empty { text-align: center; color: var(--muted); padding: 36px !important; }

@media (max-width: 1000px) { .filters { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) {
  .filters { grid-template-columns: 1fr; }
  .reset { width: 100%; }
  th, td { padding-inline: 11px; }
}
</style>
