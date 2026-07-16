<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import api, { downloadPdf } from '../api'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { PRIORITY, TASK_STATUS, fmtDate } from '../labels'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const isEmployee = computed(() => auth.user?.role === 'employee')

const tasks = ref(null)
const users = ref([])
const brands = ref([])
const filterBrand = ref('')
const filterAssignee = ref('')

const activeColumns = [
  { id: 'todo', label: 'К выполнению' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'review', label: 'На проверке' },
]
const doneColumn = { id: 'done', label: 'Выполнено' }
const showCompleted = ref(false)
const columns = computed(() => showCompleted.value ? [...activeColumns, doneColumn] : activeColumns)
const completedCount = computed(() => (tasks.value || []).filter((t) => t.status === 'done').length)

// --- модалки ---
const createModal = ref(false)
const saving = ref(false)
const blank = { title: '', description: '', brand: null, assignee: null, deadline: null, priority: 'medium', priority_mode: 'manual', status: 'todo' }
const form = reactive({ ...blank })

const detail = ref(null)       // подробная задача
const commentText = ref('')
const fileInput = ref(null)
const detailOpeningId = ref(null)
let syncTimer = null
let syncInFlight = false
let suppressCardClick = false

async function load() {
  const params = new URLSearchParams()
  if (filterBrand.value) params.set('brand', filterBrand.value)
  if (filterAssignee.value) params.set('assignee', filterAssignee.value)
  const { data } = await api.get(`/tasks/?${params}`)
  tasks.value = data
}

onMounted(async () => {
  if (!auth.user) await auth.fetchMe()
  if (!isEmployee.value) {
    const [u, b] = await Promise.all([api.get('/users/'), api.get('/brands/')])
    users.value = u.data
    brands.value = b.data
  }
  await load()
  syncTimer = setInterval(syncFromServer, 3000)
  window.addEventListener('focus', syncFromServer)
})

onUnmounted(() => {
  clearInterval(syncTimer)
  window.removeEventListener('focus', syncFromServer)
})

async function syncFromServer() {
  if (syncInFlight || document.hidden || createModal.value || saving.value) return
  syncInFlight = true
  try {
    await load()
    if (detail.value) {
      const { data } = await api.get(`/tasks/${detail.value.id}/`)
      detail.value = data
    }
  } finally {
    syncInFlight = false
  }
}

const byColumn = computed(() => {
  const map = { todo: [], in_progress: [], review: [], done: [] }
  for (const t of tasks.value || []) if (map[t.status]) map[t.status].push(t)
  return map
})

// --- drag & drop ---
const dragId = ref(null)
const dragOver = ref('')
async function onDrop(status) {
  // сотрудник двигает задачи только кнопками «Взять в работу» / «На проверку»
  if (isEmployee.value) return
  const task = tasks.value.find((t) => t.id === dragId.value)
  dragOver.value = ''
  if (!task || task.status === status) return
  const prev = task.status
  task.status = status // оптимистично — интерфейс отвечает мгновенно
  try {
    await api.patch(`/tasks/${task.id}/`, { status })
    await load()
  } catch {
    task.status = prev
  } finally {
    dragId.value = null
  }
}

function onDragStart(taskId) {
  dragId.value = taskId
  suppressCardClick = true
}

function onDragEnd() {
  dragId.value = null
  // click после dragend генерируется в том же event loop — пропускаем только его.
  setTimeout(() => { suppressCardClick = false }, 0)
}

/** Кнопки workflow в карточке задачи */
async function setDetailStatus(status) {
  await patchDetail({ status })
}

async function createTask() {
  saving.value = true
  try {
    await api.post('/tasks/', form)
    createModal.value = false
    Object.assign(form, blank)
    await load()
  } finally {
    saving.value = false
  }
}

async function openDetail(task) {
  if (suppressCardClick || detail.value || detailOpeningId.value !== null) return
  detailOpeningId.value = task.id
  try {
    const { data } = await api.get(`/tasks/${task.id}/`)
    // Если пользователь успел уйти со страницы, устаревший ответ не открывает окно.
    if (detailOpeningId.value === task.id) detail.value = data
  } finally {
    if (detailOpeningId.value === task.id) detailOpeningId.value = null
  }
}

async function refreshDetail() {
  const { data } = await api.get(`/tasks/${detail.value.id}/`)
  detail.value = data
  await load()
}

async function patchDetail(fields) {
  await api.patch(`/tasks/${detail.value.id}/`, fields)
  await refreshDetail()
}

async function addComment() {
  if (!commentText.value.trim()) return
  await api.post(`/tasks/${detail.value.id}/comment/`, { text: commentText.value })
  commentText.value = ''
  await refreshDetail()
}

async function uploadFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  await api.post(`/tasks/${detail.value.id}/attach/`, fd)
  e.target.value = ''
  await refreshDetail()
}

async function removeTask() {
  await api.delete(`/tasks/${detail.value.id}/`)
  detail.value = null
  await load()
}

function fileName(url) {
  return decodeURIComponent(url.split('/').pop())
}
</script>

<template>
  <div class="tasks-page">
    <div class="head">
      <h1 class="page-title" style="margin: 0">{{ isEmployee ? 'Мои задачи' : 'Задачи' }}</h1>
      <div class="filters">
        <select v-model="filterBrand" class="select" @change="load">
          <option value="">Все проекты</option>
          <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
        <select v-if="!isEmployee" v-model="filterAssignee" class="select" @change="load">
          <option value="">Все исполнители</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }}</option>
        </select>
        <button class="btn soft" @click="downloadPdf(`/tasks/pdf/?brand=${filterBrand}&assignee=${filterAssignee}`, 'Tasks.pdf')">↓ PDF</button>
        <button class="btn soft" @click="showCompleted = !showCompleted">
          {{ showCompleted ? 'Скрыть выполненные' : `Архив (${completedCount})` }}
        </button>
        <button v-if="!isEmployee" class="btn" @click="createModal = true">+ Задача</button>
      </div>
    </div>

    <div v-if="!tasks" class="board">
      <div v-for="i in 4" :key="i" class="skeleton" style="height: 300px" />
    </div>

    <div v-else class="board" :class="{ 'without-archive': !showCompleted }">
      <div
        v-for="col in columns" :key="col.id"
        class="column" :class="{ over: dragOver === col.id }"
        @dragover.prevent="dragOver = col.id"
        @dragleave="dragOver = ''"
        @drop="onDrop(col.id)"
      >
        <header>
          <span class="dot" :style="{ background: TASK_STATUS[col.id].color }" />
          {{ col.label }}
          <span class="count">{{ byColumn[col.id].length }}</span>
        </header>

        <TransitionGroup name="flip" tag="div" class="cards">
          <article
            v-for="t in byColumn[col.id]" :key="t.id"
            class="card task flip-move"
            :draggable="!isEmployee"
            @dragstart="onDragStart(t.id)"
            @dragend="onDragEnd"
            @click="openDetail(t)"
          >
            <div class="task-top">
              <StatusBadge :map="PRIORITY" :value="t.priority" />
              <span v-if="t.is_overdue" class="badge" style="background: var(--red-soft); color: var(--red)">просрочено</span>
            </div>
            <h4>{{ t.title }}</h4>
            <span class="proj">{{ t.brand_name || 'Без проекта' }}</span>
            <div class="task-bottom">
              <UserAvatar :user="t.assignee_detail" :size="24" />
              <span class="dl" :class="{ red: t.is_overdue }">{{ fmtDate(t.deadline, true) }}</span>
              <span v-if="t.comments_count" class="cmt">💬 {{ t.comments_count }}</span>
            </div>
          </article>
        </TransitionGroup>
      </div>
    </div>

    <!-- ===== создание ===== -->
    <AppModal :open="createModal" title="Новая задача" width="560px" @close="createModal = false">
      <div class="form">
        <div><label class="field">Название *</label><input v-model="form.title" class="input" /></div>
        <div><label class="field">Описание</label><textarea v-model="form.description" class="textarea" rows="3" /></div>
        <div class="row2">
          <div>
            <label class="field">Проект</label>
            <select v-model="form.brand" class="select">
              <option :value="null">—</option>
              <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div>
            <label class="field">Исполнитель</label>
            <select v-model="form.assignee" class="select">
              <option :value="null">—</option>
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }}</option>
            </select>
          </div>
        </div>
        <div class="row2">
          <div><label class="field">Дедлайн</label><input v-model="form.deadline" type="datetime-local" class="input" /></div>
          <div>
            <label class="field">Приоритет</label>
            <div class="prio-row">
              <select v-model="form.priority" class="select" :disabled="form.priority_mode === 'auto'">
                <option v-for="(v, k) in PRIORITY" :key="k" :value="k">{{ v.label }}</option>
              </select>
              <div class="mode-switch">
                <button type="button" :class="{ on: form.priority_mode === 'manual' }" @click="form.priority_mode = 'manual'">Ручной</button>
                <button type="button" :class="{ on: form.priority_mode === 'auto' }" @click="form.priority_mode = 'auto'">Авто</button>
              </div>
            </div>
            <p v-if="form.priority_mode === 'auto'" class="mode-hint">Приоритет будет расти сам по мере приближения дедлайна</p>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn outline" @click="createModal = false">Отмена</button>
        <button class="btn" :disabled="saving || !form.title" @click="createTask">Создать</button>
      </template>
    </AppModal>

    <!-- ===== детали ===== -->
    <AppModal :open="!!detail" :title="detail?.title || ''" width="680px" @close="detail = null">
      <div v-if="detail" class="detail">
        <!-- workflow: сотрудник ведёт задачу до проверки, менеджер одобряет -->
        <div v-if="isEmployee" class="workflow">
          <template v-if="detail.status === 'todo'">
            <button class="btn" @click="setDetailStatus('in_progress')">▶ Взять в работу</button>
          </template>
          <template v-else-if="detail.status === 'in_progress'">
            <button class="btn" style="background: var(--violet)" @click="setDetailStatus('review')">🟣 Отправить на проверку</button>
          </template>
          <template v-else-if="detail.status === 'review'">
            <span class="wf-note violet">🟣 Задача на проверке у менеджера — ждите решения</span>
          </template>
          <template v-else-if="detail.status === 'done'">
            <span class="wf-note green">✓ Задача принята менеджером</span>
          </template>
        </div>

        <div v-else-if="detail.status === 'review'" class="workflow manager">
          <span class="wf-note violet">Сотрудник отправил задачу на проверку</span>
          <button class="btn" style="background: var(--green)" @click="setDetailStatus('done')">✓ Принять</button>
          <button class="btn outline" @click="setDetailStatus('in_progress')">✏ Вернуть на доработку</button>
        </div>

        <div v-if="!isEmployee" class="detail-controls">
          <div>
            <label class="field">Статус</label>
            <select class="select" :value="detail.status" @change="patchDetail({ status: $event.target.value })">
              <option v-for="(v, k) in TASK_STATUS" :key="k" :value="k">{{ v.label }}</option>
            </select>
          </div>
          <div>
            <label class="field">Исполнитель</label>
            <select class="select" :value="detail.assignee" @change="patchDetail({ assignee: $event.target.value || null })">
              <option :value="null">—</option>
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }}</option>
            </select>
          </div>
          <div>
            <label class="field">Приоритет</label>
            <select class="select" :value="detail.priority" :disabled="detail.priority_mode === 'auto'"
              @change="patchDetail({ priority: $event.target.value })">
              <option v-for="(v, k) in PRIORITY" :key="k" :value="k">{{ v.label }}</option>
            </select>
            <div class="mode-switch" style="margin-top: 6px">
              <button type="button" :class="{ on: detail.priority_mode === 'manual' }"
                @click="patchDetail({ priority_mode: 'manual' })">Ручной</button>
              <button type="button" :class="{ on: detail.priority_mode === 'auto' }"
                @click="patchDetail({ priority_mode: 'auto' })">Авто</button>
            </div>
          </div>
        </div>

        <p v-if="detail.description" class="desc">{{ detail.description }}</p>
        <p class="meta">
          Проект: <strong>{{ detail.brand_name || '—' }}</strong> ·
          Дедлайн: <strong :style="detail.is_overdue ? 'color: var(--red)' : ''">{{ fmtDate(detail.deadline, true) }}</strong> ·
          Создал: <strong>{{ detail.creator_detail?.full_name || '—' }}</strong>
        </p>

        <h4>Файлы</h4>
        <div class="files">
          <a v-for="a in detail.attachments" :key="a.id" :href="a.file" target="_blank" class="file-chip">
            📎 {{ fileName(a.file) }}
          </a>
          <button class="btn outline sm" @click="fileInput.click()">+ Файл</button>
          <input ref="fileInput" type="file" hidden @change="uploadFile" />
        </div>

        <h4>Комментарии</h4>
        <div class="comments">
          <div v-for="c in detail.comments" :key="c.id" class="comment">
            <UserAvatar :user="c.author_detail" :size="26" />
            <div>
              <div class="c-head"><strong>{{ c.author_detail?.full_name }}</strong><span>{{ fmtDate(c.created_at, true) }}</span></div>
              <p>{{ c.text }}</p>
            </div>
          </div>
          <div class="comment-form">
            <input v-model="commentText" class="input" placeholder="Написать комментарий…" @keydown.enter="addComment" />
            <button class="btn" @click="addComment">→</button>
          </div>
        </div>

        <h4>История</h4>
        <ul class="history">
          <li v-for="h in detail.history" :key="h.id">
            <span class="h-time">{{ fmtDate(h.created_at, true) }}</span>
            <span>{{ h.user_detail?.full_name || 'Система' }}: {{ h.action }}</span>
          </li>
        </ul>
      </div>
      <template #footer>
        <button v-if="!isEmployee" class="btn danger" style="margin-right: auto" @click="removeTask">Удалить</button>
        <button class="btn outline" @click="detail = null">Закрыть</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
.filters { display: flex; gap: 9px; }
.filters .select { width: 170px; }

.board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  align-items: start;
}
.board.without-archive { grid-template-columns: repeat(3, 1fr); }
.column {
  background: var(--sunken);
  border-radius: var(--radius);
  padding: 10px;
  min-height: 240px;
  transition: box-shadow var(--dur-fast) ease, background-color var(--dur-fast) ease;
}
.column.over { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
.column header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.86rem;
  padding: 4px 6px 10px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; }
.count { margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; }

.cards { display: flex; flex-direction: column; gap: 8px; position: relative; }
.task {
  padding: 12px 14px;
  cursor: grab;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) ease;
}
.task:active { cursor: grabbing; transform: scale(0.98); }
@media (hover: hover) and (pointer: fine) {
  .task:hover { box-shadow: var(--shadow-md); }
}
.task-top { display: flex; gap: 6px; margin-bottom: 7px; }
.task h4 { font-size: 0.92rem; line-height: 1.3; }
.proj { color: var(--muted); font-size: 0.78rem; }
.task-bottom { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.dl { font-size: 0.78rem; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.dl.red { color: var(--red); font-weight: 600; }
.cmt { margin-left: auto; font-size: 0.76rem; color: var(--muted); }

.form { display: flex; flex-direction: column; gap: 13px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.prio-row { display: flex; gap: 8px; align-items: center; }
.prio-row .select { flex: 1; }
.mode-switch {
  display: inline-flex;
  gap: 2px;
  background: var(--sunken);
  border-radius: 8px;
  padding: 2px;
  flex: none;
}
.mode-switch button {
  border: 0;
  background: transparent;
  padding: 6px 11px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
  transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
}
.mode-switch button.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
.mode-hint { font-size: 0.76rem; color: var(--muted); margin-top: 5px; }

.detail h4 { font-size: 0.88rem; margin: 18px 0 8px; color: var(--ink-2); }
.workflow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.wf-note { font-weight: 600; font-size: 0.9rem; }
.wf-note.violet { color: var(--violet); }
.wf-note.green { color: var(--green); }
.workflow.manager .wf-note { margin-right: auto; }
.detail-controls { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.desc { margin-top: 14px; font-size: 0.92rem; white-space: pre-line; }
.meta { color: var(--muted); font-size: 0.84rem; margin-top: 10px; }
.meta strong { color: var(--ink-2); }

.files { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.file-chip {
  background: var(--accent-soft);
  color: var(--accent-ink);
  border-radius: 99px;
  padding: 5px 12px;
  font-size: 0.82rem;
  text-decoration: none;
  font-weight: 600;
}

.comments { display: flex; flex-direction: column; gap: 10px; }
.comment { display: flex; gap: 10px; }
.c-head { display: flex; gap: 8px; align-items: baseline; font-size: 0.84rem; }
.c-head span { color: var(--muted); font-size: 0.74rem; }
.comment p { font-size: 0.89rem; }
.comment-form { display: flex; gap: 8px; }

.history { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.history li { font-size: 0.82rem; color: var(--ink-2); display: flex; gap: 10px; }
.h-time { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }

@media (max-width: 1100px) {
  .board, .board.without-archive { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .head { align-items: stretch; }
  .filters { width: 100%; flex-wrap: wrap; }
  .filters .select { width: auto; flex: 1 1 150px; }
  .filters .btn { flex: 1 1 auto; }
  .board, .board.without-archive { grid-template-columns: 1fr; gap: 10px; }
  .column { min-height: 120px; padding: 9px; }
  .task { padding: 14px; }
  .row2, .detail-controls { grid-template-columns: 1fr; }
  .prio-row { align-items: stretch; flex-direction: column; }
  .mode-switch { width: 100%; }
  .mode-switch button { flex: 1; min-height: 40px; }
  .workflow { align-items: stretch; padding: 12px; }
  .workflow .btn { width: 100%; }
  .workflow.manager .wf-note { width: 100%; }
  .meta { line-height: 1.7; }
  .comment-form .btn { width: 44px; padding-inline: 0; flex: 0 0 44px; }
  .history li { flex-direction: column; gap: 1px; padding-block: 4px; }
  .h-time { white-space: normal; }
}
</style>
