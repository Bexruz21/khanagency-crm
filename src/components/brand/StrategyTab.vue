<script setup>
import { onMounted, ref } from 'vue'
import api, { downloadPdf } from '../../api'
import AppModal from '../AppModal.vue'

const props = defineProps({ brand: Object })

const strategy = ref(null)
const loaded = ref(false)
const generating = ref(false)
const saving = ref(false)
const error = ref('')
const aiModal = ref(false)
const brief = ref('')

const listFields = [
  { key: 'goals', title: 'Цели' },
  { key: 'kpi', title: 'KPI' },
  { key: 'channels', title: 'Каналы продвижения' },
  { key: 'recommendations', title: 'Рекомендации' },
]
const textFields = [
  { key: 'target_audience', title: 'Целевая аудитория' },
  { key: 'positioning', title: 'Позиционирование' },
  { key: 'tone_of_voice', title: 'Tone of Voice' },
  { key: 'strategy', title: 'Маркетинговая стратегия', tall: true },
]

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
    const { data } = await api.post(`/brands/${props.brand.id}/strategy/generate/`, { brief: brief.value })
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
      <div class="actions">
        <button class="btn outline" @click="startManual">Заполнить вручную</button>
        <button class="btn" @click="brief = brand.description; aiModal = true">✦ Сгенерировать с AI</button>
      </div>
    </div>

    <div v-else>
      <div class="toolbar">
        <span v-if="strategy.generated_by_ai" class="badge ai-badge">✦ создана AI — отредактируйте под себя</span>
        <span v-else />
        <div class="actions">
          <button class="btn outline sm" @click="brief = brand.description; aiModal = true">✦ Перегенерировать</button>
          <button class="btn soft sm" @click="downloadPdf(`/brands/${brand.id}/strategy/pdf/`, `Strategy_${brand.name}.pdf`)">↓ PDF</button>
          <button class="btn sm" :disabled="saving" @click="save">{{ saving ? 'Сохраняем…' : 'Сохранить' }}</button>
        </div>
      </div>

      <div class="cols">
        <div class="col">
          <section v-for="f in listFields" :key="f.key" class="card sec rise">
            <h3>{{ f.title }}</h3>
            <div class="items">
              <div v-for="(item, i) in strategy[f.key]" :key="f.key + i" class="item">
                <textarea
                  v-model="strategy[f.key][i]" class="textarea line" rows="1"
                  @input="$event.target.style.height = 'auto'; $event.target.style.height = $event.target.scrollHeight + 'px'"
                />
                <button class="btn ghost sm" @click="strategy[f.key].splice(i, 1)">✕</button>
              </div>
            </div>
            <button class="btn ghost sm add" @click="strategy[f.key].push('')">+ Добавить</button>
          </section>
        </div>
        <div class="col">
          <section v-for="f in textFields" :key="f.key" class="card sec rise">
            <h3>{{ f.title }}</h3>
            <textarea v-model="strategy[f.key]" class="textarea" :rows="f.tall ? 12 : 4" />
          </section>
        </div>
      </div>
    </div>

    <AppModal :open="aiModal" title="AI-генерация стратегии" @close="aiModal = false">
      <label class="field">Краткое описание бренда</label>
      <textarea v-model="brief" class="textarea" rows="5"
        placeholder="Продукт, аудитория, цели бизнеса, бюджет, конкуренты…" />
      <p v-if="error" class="error">{{ error }}</p>
      <template #footer>
        <button class="btn outline" @click="aiModal = false">Отмена</button>
        <button class="btn" :disabled="generating || !brief.trim()" @click="generate">
          <span v-if="generating" class="spinner" />
          {{ generating ? 'Claude думает…' : '✦ Сгенерировать' }}
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

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 14px; }
.sec { padding: 16px 18px; }
.sec h3 { font-size: 0.94rem; margin-bottom: 10px; color: var(--accent-ink); }

.items { display: flex; flex-direction: column; gap: 7px; }
.item { display: flex; gap: 6px; align-items: flex-start; }
.line { min-height: 38px; overflow: hidden; }
.add { margin-top: 8px; color: var(--muted); }
.error { color: var(--red); font-size: 0.85rem; margin-top: 10px; }

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgb(255 255 255 / 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
</style>
