<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../api'
import StatusBadge from '../components/StatusBadge.vue'
import { CONTENT_FORMAT, CONTENT_STATUS, PRIORITY, fmtDate } from '../labels'

const items = ref(null)
const filterStatus = ref('')

const filtered = computed(() =>
  !items.value ? [] : filterStatus.value
    ? items.value.filter((i) => i.status === filterStatus.value)
    : items.value
)

async function load() {
  // бэкенд сам отдаёт сотруднику только его записи
  const { data } = await api.get('/content/')
  items.value = data
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
            <th>Приоритет</th><th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filtered" :key="item.id">
            <td class="title-cell" :title="item.description">{{ item.title }}</td>
            <td>{{ item.brand_name }}</td>
            <td>{{ CONTENT_FORMAT[item.format] }}</td>
            <td>{{ fmtDate(item.shooting_date) }}</td>
            <td>{{ fmtDate(item.editing_deadline) }}</td>
            <td>{{ fmtDate(item.publish_date) }}</td>
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
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="8" class="empty">Вам пока не назначен контент</td>
          </tr>
        </tbody>
      </table>
    </div>
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
</style>
