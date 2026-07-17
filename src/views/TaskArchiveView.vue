<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../api'
import AppModal from '../components/AppModal.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { useAuthStore } from '../stores/auth'
import { TASK_STATUS, fmtDate } from '../labels'

const auth = useAuthStore()
const items = ref(null)
const brands = ref([])
const assignees = ref([])
const loading = ref(false)
const detail = ref(null)
const detailLoadingId = ref(null)
const filters = reactive({ date_from: '', date_to: '', brand: '', assignee: '' })
const isEmployee = computed(() => auth.user?.role === 'employee')

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

async function openDetail(task) {
  if (detailLoadingId.value) return
  detailLoadingId.value = task.id
  try {
    const { data } = await api.get(`/tasks/${task.id}/`)
    detail.value = data
  } finally {
    detailLoadingId.value = null
  }
}

function fileName(url) {
  if (!url) return 'Файл'
  return decodeURIComponent(url.split('/').pop().split('?')[0])
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

    <div class="card filters" :class="{ employee: isEmployee }">
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
      <div v-if="!isEmployee">
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
            <th>Дедлайн</th><th>Выполнено</th><th>Результат</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in items" :key="task.id" class="task-row" tabindex="0"
            :aria-label="`Открыть задачу ${task.title}`" @click="openDetail(task)" @keydown.enter="openDetail(task)">
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
            <td :class="task.coins_result < 0 ? 'negative' : 'positive'">
              {{ task.coins_result ? Number(task.coins_result).toLocaleString('ru-RU') : '—' }}
            </td>
          </tr>
          <tr v-if="!items.length" class="empty-row"><td class="empty">В архиве нет задач по выбранным фильтрам</td></tr>
        </tbody>
      </table>
    </div>

    <AppModal :open="!!detail" :title="detail?.title" width="760px" @close="detail = null">
      <div v-if="detail" class="detail-body">
        <div class="detail-statuses">
          <span class="badge" :style="{ color: TASK_STATUS[detail.status]?.color, background: TASK_STATUS[detail.status]?.bg }">{{ TASK_STATUS[detail.status]?.label }}</span>
        </div>

        <div class="detail-grid">
          <div><span>Бренд</span><strong>{{ detail.brand_name || '—' }}</strong></div>
          <div><span>Исполнитель</span><strong>{{ detail.assignee_detail?.full_name || '—' }}</strong></div>
          <div><span>Создано</span><strong>{{ fmtDate(detail.created_at, true) }}</strong></div>
          <div><span>Дедлайн</span><strong>{{ fmtDate(detail.deadline, true) }}</strong></div>
          <div><span>Выполнено</span><strong>{{ fmtDate(detail.completed_at, true) }}</strong></div>
          <div><span>Результат</span><strong :class="detail.coins_result < 0 ? 'negative' : 'positive'">{{ detail.coins_result ? Number(detail.coins_result).toLocaleString('ru-RU') : '—' }}</strong></div>
        </div>

        <section>
          <h4>Описание</h4>
          <p class="description">{{ detail.description || 'Описание не добавлено' }}</p>
        </section>

        <section>
          <h4>Прикреплённые файлы</h4>
          <div v-if="detail.attachments?.length" class="files">
            <a v-for="file in detail.attachments" :key="file.id" :href="file.file" target="_blank" rel="noopener" class="file-chip" @click.stop>
              <span aria-hidden="true">↗</span> {{ fileName(file.file) }}
            </a>
          </div>
          <p v-else class="muted">Файлы не прикреплены</p>
        </section>

        <section>
          <h4>Комментарии</h4>
          <div v-if="detail.comments?.length" class="comments">
            <div v-for="comment in detail.comments" :key="comment.id" class="comment">
              <UserAvatar :user="comment.author_detail" :size="30" />
              <div>
                <div class="comment-head"><strong>{{ comment.author_detail?.full_name || 'Пользователь' }}</strong><span>{{ fmtDate(comment.created_at, true) }}</span></div>
                <p>{{ comment.text }}</p>
              </div>
            </div>
          </div>
          <p v-else class="muted">Комментариев нет</p>
        </section>

        <section>
          <h4>История задания</h4>
          <ul v-if="detail.history?.length" class="history">
            <li v-for="entry in detail.history" :key="entry.id">
              <time>{{ fmtDate(entry.created_at, true) }}</time>
              <span>{{ entry.user_detail?.full_name || 'Система' }}: {{ entry.action }}</span>
            </li>
          </ul>
          <p v-else class="muted">История пока пуста</p>
        </section>
      </div>
      <template #footer><button class="btn outline" @click="detail = null">Закрыть</button></template>
    </AppModal>
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
.filters > div { min-width: 0; }
.filters .input, .filters .select { display: block; width: 100%; max-width: 100%; min-width: 0; }
.filters.employee { grid-template-columns: repeat(3, minmax(145px, 1fr)) auto; }
.reset { white-space: nowrap; }
.table-wrap { overflow-x: auto; }
table {
  --archive-columns: minmax(220px, 2fr) minmax(120px, 0.9fr) minmax(190px, 1.35fr) 145px 145px 105px;
  display: block;
  width: 100%;
  min-width: 950px;
  border-collapse: collapse;
  font-size: 0.88rem;
}
thead, tbody { display: block; width: 100%; }
thead tr, tbody tr {
  display: grid;
  grid-template-columns: var(--archive-columns);
  width: 100%;
}
th {
  text-align: left; color: var(--muted); font-size: 0.72rem; text-transform: uppercase;
  letter-spacing: 0.05em; padding: 12px 14px; border-bottom: 1px solid var(--line); white-space: nowrap;
}
td { padding: 12px 14px; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.table-wrap th:nth-child(2), .table-wrap th:nth-child(3),
.table-wrap td:nth-child(2), .table-wrap td:nth-child(3) { text-align: left; }
.table-wrap .person { justify-content: flex-start; }
tbody tr:last-child td { border-bottom: 0; }
.task-row { cursor: pointer; transition: background 140ms ease; }
.task-row:hover, .task-row:focus-visible { background: var(--sunken); outline: none; }
.title-cell { font-weight: 650; white-space: normal; overflow-wrap: anywhere; }
.person { display: flex; align-items: center; gap: 8px; min-width: 0; }
.person > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.positive { color: var(--green); font-weight: 650; }
.negative { color: var(--red); font-weight: 650; }
.empty-row { grid-template-columns: minmax(0, 1fr); }
.empty { grid-column: 1 / -1; text-align: center; color: var(--muted); padding: 36px !important; }
.detail-body { display: flex; flex-direction: column; gap: 22px; }
.detail-statuses { display: flex; gap: 8px; flex-wrap: wrap; }
.detail-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.detail-grid > div { padding: 11px 12px; border-radius: 12px; background: var(--sunken); min-width: 0; }
.detail-grid span { display: block; color: var(--muted); font-size: 0.74rem; margin-bottom: 3px; }
.detail-grid strong { display: block; font-size: 0.88rem; overflow-wrap: anywhere; }
section h4 { margin: 0 0 9px; font-size: 0.9rem; }
.description { margin: 0; white-space: pre-wrap; color: var(--ink-2); line-height: 1.55; }
.muted { color: var(--muted); margin: 0; font-size: 0.86rem; }
.files { display: flex; flex-wrap: wrap; gap: 8px; }
.file-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); text-decoration: none; font-size: 0.82rem; font-weight: 600; }
.comments { display: flex; flex-direction: column; gap: 10px; }
.comment { display: grid; grid-template-columns: auto 1fr; gap: 9px; }
.comment > div { min-width: 0; padding: 9px 11px; border-radius: 12px; background: var(--sunken); }
.comment-head { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 4px; font-size: 0.78rem; }
.comment-head span { color: var(--muted); white-space: nowrap; }
.comment p { margin: 0; color: var(--ink-2); font-size: 0.86rem; white-space: pre-wrap; }
.history { list-style: none; display: flex; flex-direction: column; gap: 7px; margin: 0; padding: 0; }
.history li { display: grid; grid-template-columns: 138px 1fr; gap: 10px; color: var(--ink-2); font-size: 0.82rem; }
.history time { color: var(--muted); }

@media (max-width: 1000px) { .filters, .filters.employee { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) {
  .filters, .filters.employee { width: 100%; max-width: 100%; grid-template-columns: minmax(0, 1fr); overflow: hidden; }
  .filters > div, .filters .input, .filters .select { width: 100%; max-width: 100%; min-width: 0; }
  .reset { width: 100%; }
  th, td { padding-inline: 11px; }
  .detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .history li { grid-template-columns: 1fr; gap: 2px; padding-block: 3px; }
  .comment-head { flex-direction: column; gap: 1px; }
}
</style>
