<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api, { downloadPdf } from '../../api'
import AppModal from '../AppModal.vue'
import StatusBadge from '../StatusBadge.vue'
import UserAvatar from '../UserAvatar.vue'
import { CONTENT_FORMAT, CONTENT_STATUS, PRIORITY, fmtDate } from '../../labels'

const props = defineProps({ brand: Object })

const items = ref(null)
const users = ref([])
const filterStatus = ref('')

// --- модалка записи (создание/редактирование) ---
const itemModal = ref(false)
const saving = ref(false)
const saveError = ref('')
const editingId = ref(null)
const blank = {
  title: '', format: 'post', description: '', assignee: null,
  shooting_date: null, editing_deadline: null, publish_date: null,
  status: 'idea', priority: 'medium', priority_mode: 'manual', comments: '',
}
const form = reactive({ ...blank })

// --- AI-идеи ---
const aiModal = ref(false)
const brief = ref('')
const ideaCount = ref(10)
const generating = ref(false)
const aiError = ref('')
const ideas = ref([])       // [{title, format, description, selected}]
const savingIdeas = ref(false)

const filtered = computed(() =>
  !items.value ? [] : filterStatus.value
    ? items.value.filter((i) => i.status === filterStatus.value)
    : items.value
)

async function load() {
  const [c, u] = await Promise.all([
    api.get(`/content/?brand=${props.brand.id}`),
    api.get('/users/'),
  ])
  items.value = c.data
  users.value = u.data
}
onMounted(load)

function openCreate() {
  editingId.value = null
  saveError.value = ''
  Object.assign(form, blank)
  itemModal.value = true
}
function openEdit(item) {
  editingId.value = item.id
  saveError.value = ''
  Object.assign(form, {
    title: item.title, format: item.format, description: item.description,
    assignee: item.assignee, shooting_date: item.shooting_date,
    editing_deadline: item.editing_deadline, publish_date: item.publish_date,
    status: item.status, priority: item.priority, priority_mode: item.priority_mode,
    comments: item.comments,
  })
  itemModal.value = true
}

async function saveItem() {
  saving.value = true
  saveError.value = ''
  try {
    // пустые даты/исполнитель должны уходить как null, а не как ""
    const payload = { ...form, brand: props.brand.id }
    for (const key of ['shooting_date', 'editing_deadline', 'publish_date', 'assignee']) {
      if (payload[key] === '' || payload[key] === undefined) payload[key] = null
    }
    if (editingId.value) await api.patch(`/content/${editingId.value}/`, payload)
    else await api.post('/content/', payload)
    itemModal.value = false
    await load()
  } catch (e) {
    const data = e.response?.data
    saveError.value = data
      ? Object.entries(data).map(([k, v]) => `${k}: ${[].concat(v).join(' ')}`).join('; ')
      : 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}

async function removeItem() {
  if (!editingId.value) return
  await api.delete(`/content/${editingId.value}/`)
  itemModal.value = false
  await load()
}

async function setStatus(item, status) {
  await api.patch(`/content/${item.id}/`, { status })
  item.status = status
}

async function generateIdeas() {
  generating.value = true
  aiError.value = ''
  try {
    const { data } = await api.post(
      '/content/generate-ideas/',
      { brand: props.brand.id, brief: brief.value, count: ideaCount.value },
      { timeout: 240000 },
    )
    ideas.value = data.ideas.map((i) => ({ ...i, selected: true }))
  } catch (e) {
    aiError.value = e.response?.data?.detail || 'Ошибка генерации'
  } finally {
    generating.value = false
  }
}

async function saveIdeas() {
  savingIdeas.value = true
  try {
    await api.post('/content/bulk-create/', {
      brand: props.brand.id,
      items: ideas.value.filter((i) => i.selected),
    })
    aiModal.value = false
    ideas.value = []
    await load()
  } finally {
    savingIdeas.value = false
  }
}

const selectedCount = computed(() => ideas.value.filter((i) => i.selected).length)
</script>

<template>
  <div>
    <div class="toolbar">
      <select v-model="filterStatus" class="select" style="width: 180px">
        <option value="">Все статусы</option>
        <option v-for="(v, k) in CONTENT_STATUS" :key="k" :value="k">{{ v.label }}</option>
      </select>
      <div class="actions">
        <button class="btn soft sm" @click="downloadPdf(`/content/pdf/?brand=${brand.id}`, `ContentPlan_${brand.name}.pdf`)">↓ PDF</button>
        <button class="btn outline sm" @click="brief = brand.description; ideas = []; aiModal = true">✦ AI-идеи</button>
        <button class="btn sm" @click="openCreate">+ Запись</button>
      </div>
    </div>

    <div v-if="!items" class="skeleton" style="height: 260px" />

    <div v-else class="card table-wrap rise">
      <table>
        <thead>
          <tr>
            <th>Название</th><th>Формат</th><th>Ответственный</th>
            <th>Съёмка</th><th>Монтаж</th><th>Публикация</th>
            <th>Статус</th><th>Приоритет</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filtered" :key="item.id" @click="openEdit(item)">
            <td class="title-cell">
              <span v-if="item.generated_by_ai" class="ai-dot" title="Идея от AI">✦</span>
              {{ item.title }}
            </td>
            <td>{{ CONTENT_FORMAT[item.format] }}</td>
            <td>
              <span v-if="item.assignee_detail" class="assignee">
                <UserAvatar :user="item.assignee_detail" :size="22" />
                {{ item.assignee_detail.full_name.split(' ')[0] }}
              </span>
              <span v-else class="muted">—</span>
            </td>
            <td>{{ fmtDate(item.shooting_date) }}</td>
            <td>{{ fmtDate(item.editing_deadline) }}</td>
            <td>{{ fmtDate(item.publish_date) }}</td>
            <td @click.stop>
              <select
                class="status-select" :value="item.status"
                :style="{ color: CONTENT_STATUS[item.status]?.color, background: CONTENT_STATUS[item.status]?.bg }"
                @change="setStatus(item, $event.target.value)"
              >
                <option v-for="(v, k) in CONTENT_STATUS" :key="k" :value="k">{{ v.label }}</option>
              </select>
            </td>
            <td>
              <StatusBadge :map="PRIORITY" :value="item.priority" />
              <span v-if="item.priority_mode === 'auto'" class="auto-mark" title="Приоритет обновляется автоматически">A</span>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="8" class="empty">Записей нет — добавьте вручную или сгенерируйте идеи с AI</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===== запись ===== -->
    <AppModal :open="itemModal" :title="editingId ? 'Редактировать запись' : 'Новая запись'" width="620px" @close="itemModal = false">
      <div class="form">
        <div><label class="field">Название *</label><input v-model="form.title" class="input" /></div>
        <div class="row2">
          <div>
            <label class="field">Формат</label>
            <select v-model="form.format" class="select">
              <option v-for="(v, k) in CONTENT_FORMAT" :key="k" :value="k">{{ v }}</option>
            </select>
          </div>
          <div>
            <label class="field">Статус</label>
            <select v-model="form.status" class="select">
              <option v-for="(v, k) in CONTENT_STATUS" :key="k" :value="k">{{ v.label }}</option>
            </select>
          </div>
        </div>
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
          <p v-if="form.priority_mode === 'auto'" class="mode-hint">Приоритет растёт сам по мере приближения дат съёмки/монтажа/публикации</p>
        </div>
        <div><label class="field">Описание</label><textarea v-model="form.description" class="textarea" rows="3" /></div>
        <div class="row3">
          <div><label class="field">Дата съёмки</label><input v-model="form.shooting_date" type="date" class="input" /></div>
          <div><label class="field">Дедлайн монтажа</label><input v-model="form.editing_deadline" type="date" class="input" /></div>
          <div><label class="field">Публикация</label><input v-model="form.publish_date" type="date" class="input" /></div>
        </div>
        <div>
          <label class="field">Ответственный</label>
          <select v-model="form.assignee" class="select">
            <option :value="null">—</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }}</option>
          </select>
        </div>
        <div><label class="field">Комментарии</label><textarea v-model="form.comments" class="textarea" rows="2" /></div>
        <p v-if="saveError" class="error">{{ saveError }}</p>
      </div>
      <template #footer>
        <button v-if="editingId" class="btn danger" style="margin-right: auto" @click="removeItem">Удалить</button>
        <button class="btn outline" @click="itemModal = false">Отмена</button>
        <button class="btn" :disabled="saving || !form.title" @click="saveItem">Сохранить</button>
      </template>
    </AppModal>

    <!-- ===== AI-идеи ===== -->
    <AppModal :open="aiModal" title="✦ AI: идеи для контент-плана" width="640px" @close="aiModal = false">
      <template v-if="!ideas.length">
        <div class="ai-guide">
          <strong>Контент на узбекском языке латиницей</strong>
          <span>AI подготовит производственные идеи только для Reels, Post и Stories: hook, визуал, цель и CTA.</span>
        </div>
        <label class="field">Краткая информация о бренде</label>
        <textarea v-model="brief" class="textarea" rows="4"
          placeholder="Продукт, аудитория, тон, что хотим продвигать в этом месяце…" />
        <label class="field" style="margin-top: 12px">Сколько идей</label>
        <div class="count-row">
          <button
            v-for="n in [5, 10, 20, 30]" :key="n" type="button"
            class="chip" :class="{ on: ideaCount === n }" @click="ideaCount = n"
          >{{ n }}{{ n === 20 ? ' · неделя' : n === 30 ? ' · месяц' : '' }}</button>
        </div>
        <p v-if="aiError" class="error">{{ aiError }}</p>
      </template>

      <template v-else>
        <p class="hint">Выберите идеи — они попадут в таблицу контент-плана. Всё можно будет отредактировать.</p>
        <div class="ideas">
          <label v-for="(idea, i) in ideas" :key="i" class="idea rise" :class="{ off: !idea.selected }">
            <input v-model="idea.selected" type="checkbox" />
            <div>
              <strong>{{ idea.title }}</strong>
              <span class="fmt">{{ CONTENT_FORMAT[idea.format] || idea.format }}</span>
              <p>{{ idea.description }}</p>
            </div>
          </label>
        </div>
      </template>

      <template #footer>
        <template v-if="!ideas.length">
          <button class="btn outline" @click="aiModal = false">Отмена</button>
          <button class="btn" :disabled="generating || !brief.trim()" @click="generateIdeas">
            <span v-if="generating" class="spinner" />
            {{ generating ? 'AI разрабатывает идеи…' : '✦ Предложить идеи' }}
          </button>
        </template>
        <template v-else>
          <button class="btn outline" style="margin-right: auto" @click="ideas = []">← Назад</button>
          <button class="btn" :disabled="savingIdeas || !selectedCount" @click="saveIdeas">
            Добавить в план ({{ selectedCount }})
          </button>
        </template>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 10px; }
.actions { display: flex; gap: 8px; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
th {
  text-align: left;
  font-size: 0.73rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
td { padding: 11px 14px; border-bottom: 1px solid var(--line); white-space: nowrap; }
tbody tr { cursor: pointer; transition: background-color var(--dur-fast) ease; }
tbody tr:last-child td { border-bottom: 0; }
@media (hover: hover) and (pointer: fine) {
  tbody tr:hover { background: var(--sunken); }
}
.title-cell { font-weight: 600; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.ai-dot { color: var(--violet); margin-right: 3px; }
.assignee { display: inline-flex; align-items: center; gap: 7px; }
.muted { color: var(--muted); }
.ai-guide { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; margin-bottom: 14px; border-radius: 12px; background: var(--accent-soft); color: var(--accent-ink); font-size: 0.82rem; line-height: 1.4; }
.ai-guide strong { font-size: 0.88rem; }
.empty { text-align: center; color: var(--muted); padding: 28px !important; cursor: default; }

.status-select {
  border: 0;
  border-radius: 99px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  appearance: none;
  outline: none;
}

.form { display: flex; flex-direction: column; gap: 13px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

.prio-row { display: flex; gap: 8px; align-items: center; }
.prio-row .select { flex: 1; }
.mode-switch { display: inline-flex; gap: 2px; background: var(--sunken); border-radius: 8px; padding: 2px; flex: none; }
.mode-switch button {
  border: 0; background: transparent; padding: 6px 11px; border-radius: 6px;
  font-size: 0.8rem; font-weight: 600; color: var(--ink-2); cursor: pointer;
  transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
}
.mode-switch button.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
.mode-hint { font-size: 0.76rem; color: var(--muted); margin-top: 5px; }
.auto-mark {
  display: inline-grid; place-items: center;
  width: 16px; height: 16px; margin-left: 5px;
  border-radius: 5px; background: var(--accent-soft); color: var(--accent);
  font-size: 0.62rem; font-weight: 800; vertical-align: middle;
}

.count-row { display: flex; gap: 8px; }
.chip {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 99px;
  padding: 6px 14px;
  font-size: 0.86rem;
  cursor: pointer;
  transition: transform var(--dur-press) var(--ease-out), background-color var(--dur-fast) ease,
              color var(--dur-fast) ease, border-color var(--dur-fast) ease;
}
.chip:active { transform: scale(0.95); }
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }

.hint { color: var(--muted); font-size: 0.86rem; margin-bottom: 12px; }
.ideas { display: flex; flex-direction: column; gap: 8px; max-height: 46vh; overflow-y: auto; }
.idea {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--dur-fast) ease, opacity var(--dur-fast) ease, background-color var(--dur-fast) ease;
}
.idea.off { opacity: 0.45; }
.idea input { accent-color: var(--accent); }
.idea strong { font-size: 0.92rem; }
.idea .fmt {
  margin-left: 8px;
  font-size: 0.73rem;
  background: var(--accent-soft);
  color: var(--accent-ink);
  border-radius: 99px;
  padding: 2px 8px;
  font-weight: 600;
}
.idea p { color: var(--ink-2); font-size: 0.83rem; margin-top: 3px; }
@media (hover: hover) and (pointer: fine) {
  .idea:hover { border-color: var(--accent); background: var(--accent-soft); }
}

.error { color: var(--red); font-size: 0.85rem; margin-top: 10px; }
.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgb(255 255 255 / 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .toolbar { align-items: stretch; flex-direction: column; }
  .toolbar .select { width: 100% !important; }
  .actions { flex-wrap: wrap; }
  .actions .btn { flex: 1 1 auto; }
  .row2, .row3 { grid-template-columns: 1fr; }
  .prio-row { align-items: stretch; flex-direction: column; }
  .mode-switch { width: 100%; }
  .mode-switch button { flex: 1; min-height: 40px; }
  .chip { min-height: 40px; }
  .idea { padding: 12px; }
  .idea .fmt { display: inline-block; margin: 4px 0 0; }
}
</style>
