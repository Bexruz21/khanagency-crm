<script setup>
import { computed, onMounted, ref } from 'vue'
import api, { downloadPdf } from '../../api'
import AppModal from '../AppModal.vue'
import AppIcon from '../AppIcon.vue'

const props = defineProps({ brand: Object, canEdit: { type: Boolean, default: false } })

const strategy = ref(null)
const loaded = ref(false)
const generating = ref(false)
const saving = ref(false)
const error = ref('')
const aiModal = ref(false)
const brief = ref('')

const listFields = [
  { key: 'goals', title: 'Цели', hint: 'Измеримые результаты и сроки' },
  { key: 'kpi', title: 'KPI', hint: 'Метрика, целевое значение и период' },
  { key: 'channels', title: 'Каналы продвижения', hint: 'Роль каждого канала и ожидаемый результат' },
  { key: 'recommendations', title: 'Рекомендации', hint: 'Приоритетные следующие действия' },
]
const textFields = [
  { key: 'target_audience', title: 'Целевая аудитория', hint: 'Сегменты, потребности, мотивы и возражения' },
  { key: 'positioning', title: 'Позиционирование', hint: 'Обещание бренда, отличие и доказательство' },
  { key: 'tone_of_voice', title: 'Tone of Voice', hint: 'Как бренд говорит и какие формулировки использует' },
  { key: 'strategy', title: 'Маркетинговая стратегия', hint: 'Последовательный план действий на 90 дней', tall: true },
]

const completion = computed(() => {
  if (!strategy.value) return 0
  const listDone = listFields.filter((field) => strategy.value[field.key]?.some((item) => item.trim())).length
  const textDone = textFields.filter((field) => strategy.value[field.key]?.trim()).length
  return Math.round(((listDone + textDone) / (listFields.length + textFields.length)) * 100)
})

onMounted(async () => {
  const { data } = await api.get(`/brands/${props.brand.id}/strategy/`)
  strategy.value = data
  loaded.value = true
})

function startManual() {
  strategy.value = {
    goals: [''], kpi: [''], channels: [''], recommendations: [''],
    target_audience: '', positioning: '', tone_of_voice: '', strategy: '',
    generated_by_ai: false,
  }
}

async function generate() {
  generating.value = true
  error.value = ''
  try {
    const { data } = await api.post(
      `/brands/${props.brand.id}/strategy/generate/`,
      { brief: brief.value },
      { timeout: 240000 },
    )
    strategy.value = data
    aiModal.value = false
  } catch (e) {
    error.value = e.response?.data?.detail || 'Ошибка генерации'
  } finally {
    generating.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload = { ...strategy.value }
    for (const f of listFields) payload[f.key] = strategy.value[f.key].filter((x) => x.trim())
    const { data } = await api.put(`/brands/${props.brand.id}/strategy/`, payload)
    strategy.value = data
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="!loaded" class="skeleton" style="height: 200px" />

    <div v-else-if="!strategy" class="card empty-state rise">
      <h2>Маркетинговая стратегия ещё не создана</h2>
      <p>Опишите бренд — AI подготовит цели, KPI, аудиторию, позиционирование и план. Или заполните вручную.</p>
      <div v-if="canEdit" class="actions">
        <button class="btn outline" @click="startManual">Заполнить вручную</button>
        <button class="btn" @click="brief = brand.description; aiModal = true"><AppIcon name="sparkles" :size="16" /> Сгенерировать с AI</button>
      </div>
    </div>

    <div v-else>
      <div class="toolbar">
        <div class="completion">
          <span>{{ completion }}% заполнено</span>
          <div><i :style="{ width: completion + '%' }" /></div>
        </div>
        <div class="actions">
          <button v-if="canEdit" class="btn outline sm" @click="brief = brand.description; aiModal = true"><AppIcon name="sparkles" :size="16" /> Перегенерировать</button>
          <button class="btn soft sm" @click="downloadPdf(`/brands/${brand.id}/strategy/pdf/`, `Strategy_${brand.name}.pdf`)">↓ PDF</button>
          <button v-if="canEdit" class="btn sm" :disabled="saving" @click="save">{{ saving ? 'Сохраняем…' : 'Сохранить' }}</button>
        </div>
      </div>

      <div class="cols">
        <div class="col">
          <section v-for="f in listFields" :key="f.key" class="card sec rise">
            <h3>{{ f.title }}</h3>
            <p class="section-hint">{{ f.hint }}</p>
            <div class="items">
              <div v-for="(item, i) in strategy[f.key]" :key="f.key + i" class="item">
                <textarea
                  v-model="strategy[f.key][i]" class="textarea line" rows="1" :readonly="!canEdit"
                  @input="$event.target.style.height = 'auto'; $event.target.style.height = $event.target.scrollHeight + 'px'"
                />
                <button v-if="canEdit" class="btn ghost sm" @click="strategy[f.key].splice(i, 1)"><AppIcon name="close" :size="15" /></button>
              </div>
            </div>
            <button v-if="canEdit" class="btn ghost sm add" @click="strategy[f.key].push('')">+ Добавить</button>
          </section>
        </div>
        <div class="col">
          <section v-for="f in textFields" :key="f.key" class="card sec rise">
            <h3>{{ f.title }}</h3>
            <p class="section-hint">{{ f.hint }}</p>
            <textarea v-model="strategy[f.key]" class="textarea" :rows="f.tall ? 12 : 4" :readonly="!canEdit" />
          </section>
        </div>
      </div>
    </div>

    <AppModal :open="aiModal" title="AI-генерация стратегии" @close="aiModal = false">
      <div class="ai-guide">
        <strong>Профессиональная стратегия на 90 дней</strong>
        <span>Укажите аудиторию, продукт, цены, географию, конкурентов и бизнес-цель.</span>
        <span>AI подготовит результат на узбекском языке латиницей: SMART-цели, KPI и план действий.</span>
      </div>
      <label class="field">Краткое описание бренда</label>
      <textarea v-model="brief" class="textarea" rows="5"
        placeholder="Продукт, аудитория, цели бизнеса, бюджет, конкуренты…" />
      <div class="brief-meta"><span>После генерации все разделы можно исправить</span><span>{{ brief.length }} символов</span></div>
      <p v-if="error" class="error">{{ error }}</p>
      <template #footer>
        <button class="btn outline" @click="aiModal = false">Отмена</button>
        <button class="btn" :disabled="generating || !brief.trim()" @click="generate">
          <span v-if="generating" class="spinner" />
          <AppIcon v-if="!generating" name="sparkles" :size="16" />{{ generating ? 'Claude думает…' : 'Сгенерировать' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.empty-state { padding: 44px; text-align: center; }
.empty-state h2 { font-size: 1.15rem; margin-bottom: 6px; }
.empty-state p { color: var(--muted); font-size: 0.9rem; margin-bottom: 20px; max-width: 480px; margin-inline: auto; }
.actions { display: inline-flex; gap: 10px; }

.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.ai-badge { background: var(--violet-soft); color: var(--violet); }
.completion { width: min(220px, 100%); color: var(--muted); font-size: 0.76rem; font-weight: 650; }
.completion > div { height: 6px; margin-top: 5px; overflow: hidden; border-radius: 99px; background: var(--line); }
.completion i { display: block; height: 100%; border-radius: inherit; background: var(--accent); transition: width 240ms var(--ease-in-out); }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 14px; }
.sec { padding: 16px 18px; }
.sec h3 { font-size: 0.94rem; margin-bottom: 10px; color: var(--accent-ink); }
.section-hint { color: var(--muted); font-size: 0.76rem; margin: -5px 0 11px; line-height: 1.4; }

.items { display: flex; flex-direction: column; gap: 7px; }
.item { display: flex; gap: 6px; align-items: flex-start; }
.line { min-height: 38px; overflow: hidden; }
.add { margin-top: 8px; color: var(--muted); }
.error { color: var(--red); font-size: 0.85rem; margin-top: 10px; }
.ai-guide { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; margin-bottom: 14px; border-radius: 12px; background: var(--accent-soft); color: var(--accent-ink); font-size: 0.82rem; line-height: 1.4; }
.ai-guide strong { font-size: 0.88rem; }
.brief-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; color: var(--muted); font-size: 0.72rem; }

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgb(255 255 255 / 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .empty-state { padding: 28px 18px; }
  .actions { width: 100%; flex-direction: column; }
  .toolbar { align-items: stretch; flex-direction: column; gap: 10px; }
  .toolbar > div { display: flex; flex-wrap: wrap; gap: 8px; }
  .cols, .col { gap: 10px; }
  .sec { padding: 14px; }
  .item .btn { flex: 0 0 38px; width: 38px; min-height: 38px; padding: 0; }
}
</style>
