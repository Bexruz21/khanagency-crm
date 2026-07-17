<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api, { downloadPdf } from '../../api'
import AppModal from '../AppModal.vue'
import AppIcon from '../AppIcon.vue'
import StatusBadge from '../StatusBadge.vue'
import UserAvatar from '../UserAvatar.vue'
import { CONTENT_FORMAT, CONTENT_STATUS, PRIORITY, allowCompactDateKey, compactDateTime, fmtDate, maskCompactDateTime } from '../../labels'

const props = defineProps({ brand: Object, canEdit: { type: Boolean, default: false } })

const items = ref(null)
const filterStatus = ref('')
const teamUsers = computed(() => props.brand.members_detail || [])

// --- модалка записи (создание/редактирование) ---
const itemModal = ref(false)
const saving = ref(false)
const saveError = ref('')
const editingId = ref(null)
const blank = {
  title: '', format: 'post', description: '', assignee: null,
  shooting_date: null, editing_deadline: null, publish_date: null,
  status: 'idea', comments: '',
}
const form = reactive({ ...blank })

const DESCRIPTION_TEMPLATES = {
  reels: `Цель ролика:
Основная идея:
Хронометраж:

СЦЕНАРИЙ СЪЁМКИ
Кадр 1 — Hook (0–3 сек.)
Изображение / действие:
Текст / реплика:
План и движение камеры:

Кадр 2
Изображение / действие:
Текст / реплика:
План и движение камеры:

Кадр 3
Изображение / действие:
Текст / реплика:
План и движение камеры:

Финальный кадр и CTA:

МОНТАЖ
Темп и переходы:
Музыка / звуки:
Титры и графика:

Реквизит и локация:
Референсы:
Дополнительные примечания:`,
  post: `Цель публикации:
Основная мысль:
Целевая аудитория:

СТРУКТУРА ПОСТА
Заголовок / Hook:
Основной текст:
Ключевые тезисы:
CTA:

ВИЗУАЛ
Формат и композиция:
Текст на макете:
Цвета / стиль:
Референсы:

Дополнительные примечания:`,
  stories: `Цель серии Stories:
Количество экранов:

ЭКРАН 1 — Hook
Визуал / действие:
Текст:

ЭКРАН 2
Визуал / действие:
Текст:

ЭКРАН 3
Визуал / действие:
Текст:

Интерактивный элемент:
Финальный CTA:
Музыка / оформление:
Дополнительные примечания:`,
}

const descriptionTemplateLabel = computed(() => ({
  reels: 'Структура сценария Reels',
  post: 'Структура публикации',
  stories: 'Структура Stories',
}[form.format] || 'Добавить структуру'))

function insertDescriptionTemplate() {
  const template = DESCRIPTION_TEMPLATES[form.format] || DESCRIPTION_TEMPLATES.post
  form.description = form.description.trim()
    ? `${form.description.trim()}\n\n——————————\n\n${template}`
    : template
}

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
  const { data } = await api.get(`/content/?brand=${props.brand.id}`)
  items.value = data
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
    assignee: item.assignee, shooting_date: compactDateTime(item.shooting_date),
    editing_deadline: compactDateTime(item.editing_deadline), publish_date: compactDateTime(item.publish_date),
    status: item.status,
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
        <button v-if="canEdit" class="btn outline sm" @click="brief = brand.description; ideas = []; aiModal = true"><AppIcon name="sparkles" :size="16" /> AI-идеи</button>
        <button v-if="canEdit" class="btn sm" @click="openCreate">+ Запись</button>
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
          <tr v-for="item in filtered" :key="item.id" :class="{ editable: canEdit }" @click="canEdit && openEdit(item)">
            <td class="title-cell">
              <span v-if="item.generated_by_ai" class="ai-dot" title="Идея от AI"><AppIcon name="sparkles" :size="14" /></span>
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
            <td>{{ fmtDate(item.shooting_date, true) }}</td>
            <td>{{ fmtDate(item.editing_deadline, true) }}</td>
            <td>{{ fmtDate(item.publish_date, true) }}</td>
            <td @click.stop>
              <select
                class="status-select" :value="item.status" :disabled="!canEdit"
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
    <AppModal :open="itemModal" :title="editingId ? 'Редактировать запись' : 'Новая запись'" width="820px" solid @close="itemModal = false">
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
        <p class="mode-hint">Приоритет рассчитывается автоматически по ближайшему этапу и его точному времени.</p>
        <div class="script-field">
          <div class="script-heading">
            <div>
              <label class="field">Сценарий и техническое задание</label>
              <span>Опишите кадры, реплики, монтаж, реквизит и CTA — текст сохраняется полностью.</span>
            </div>
            <button type="button" class="btn soft sm" @click="insertDescriptionTemplate">
              <AppIcon name="edit" :size="15" /> {{ descriptionTemplateLabel }}
            </button>
          </div>
          <textarea
            v-model="form.description" class="textarea script-textarea" rows="14"
            placeholder="Например: Кадр 1 — крупный план продукта; действие; реплика; движение камеры…"
          />
          <div class="editor-meta">
            <span>Можно вставлять ссылки и разбивать сценарий на любое количество кадров</span>
            <span>{{ form.description.length.toLocaleString('ru-RU') }} символов</span>
          </div>
        </div>
        <div class="row3">
          <div><label class="field">Съёмка</label><input :value="form.shooting_date" class="input" inputmode="numeric" maxlength="11" placeholder="ДД.ММ ЧЧ:ММ" @keydown="allowCompactDateKey" @input="$event.target.value = form.shooting_date = maskCompactDateTime($event.target.value)" /></div>
          <div><label class="field">Монтаж</label><input :value="form.editing_deadline" class="input" inputmode="numeric" maxlength="11" placeholder="ДД.ММ ЧЧ:ММ" @keydown="allowCompactDateKey" @input="$event.target.value = form.editing_deadline = maskCompactDateTime($event.target.value)" /></div>
          <div><label class="field">Публикация</label><input :value="form.publish_date" class="input" inputmode="numeric" maxlength="11" placeholder="ДД.ММ ЧЧ:ММ" @keydown="allowCompactDateKey" @input="$event.target.value = form.publish_date = maskCompactDateTime($event.target.value)" /></div>
        </div>
        <div>
          <label class="field">Ответственный</label>
          <select v-model="form.assignee" class="select">
            <option :value="null">—</option>
            <option v-for="u in teamUsers" :key="u.id" :value="u.id">{{ u.full_name }}</option>
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
    <AppModal :open="aiModal" title="AI: идеи для контент-плана" width="640px" solid @close="aiModal = false">
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
            <AppIcon v-if="!generating" name="sparkles" :size="16" />{{ generating ? 'AI разрабатывает идеи…' : 'Предложить идеи' }}
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
tbody tr { transition: background-color var(--dur-fast) ease; }
tbody tr.editable { cursor: pointer; }
tbody tr:last-child td { border-bottom: 0; }
@media (hover: hover) and (pointer: fine) {
  tbody tr.editable:hover { background: var(--sunken); }
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
.status-select:disabled { cursor: default; opacity: .82; }

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
.script-field { padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--sunken); }
.script-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
.script-heading > div { min-width: 0; }
.script-heading .field { margin-bottom: 3px; }
.script-heading span { display: block; color: var(--muted); font-size: 0.76rem; line-height: 1.4; }
.script-heading .btn { flex: none; }
.script-textarea {
  min-height: 310px;
  resize: vertical;
  background: var(--surface);
  line-height: 1.6;
  font-family: inherit;
  tab-size: 2;
}
.editor-meta { display: flex; justify-content: space-between; gap: 16px; margin-top: 7px; color: var(--muted); font-size: 0.7rem; }
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
  .script-field { padding: 11px; }
  .script-heading { flex-direction: column; }
  .script-heading .btn { width: 100%; }
  .script-textarea { min-height: 360px; }
  .editor-meta { flex-direction: column; gap: 2px; }
  .prio-row { align-items: stretch; flex-direction: column; }
  .mode-switch { width: 100%; }
  .mode-switch button { flex: 1; min-height: 40px; }
  .chip { min-height: 40px; }
  .idea { padding: 12px; }
  .idea .fmt { display: inline-block; margin: 4px 0 0; }
}
</style>
