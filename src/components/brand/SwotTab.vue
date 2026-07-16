<script setup>
import { onMounted, ref } from 'vue'
import api, { downloadPdf } from '../../api'
import AppModal from '../AppModal.vue'

const props = defineProps({ brand: Object })

const swot = ref(null)
const loaded = ref(false)
const generating = ref(false)
const saving = ref(false)
const error = ref('')
const aiModal = ref(false)
const brief = ref('')

const sections = [
  { key: 'strengths', title: 'Strengths · Kuchli tomonlar', hint: 'Brend ichidagi ustunliklar va resurslar', tone: 'green' },
  { key: 'weaknesses', title: 'Weaknesses · Zaif tomonlar', hint: 'Ichki cheklovlar va yaxshilash nuqtalari', tone: 'red' },
  { key: 'opportunities', title: 'Opportunities · Imkoniyatlar', hint: 'Bozor o‘sishi va tashqi imkoniyatlar', tone: 'sky' },
  { key: 'threats', title: 'Threats · Tahdidlar', hint: 'Tashqi xavflar va raqobat bosimi', tone: 'amber' },
]

onMounted(async () => {
  const { data } = await api.get(`/brands/${props.brand.id}/swot/`)
  swot.value = data
  loaded.value = true
})

function startManual() {
  swot.value = { strengths: [''], weaknesses: [''], opportunities: [''], threats: [''], generated_by_ai: false }
}

async function generate() {
  generating.value = true
  error.value = ''
  try {
    const { data } = await api.post(`/brands/${props.brand.id}/swot/generate/`, { brief: brief.value })
    swot.value = data
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
    const payload = {}
    for (const s of sections) payload[s.key] = swot.value[s.key].filter((x) => x.trim())
    const { data } = await api.put(`/brands/${props.brand.id}/swot/`, payload)
    swot.value = data
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="!loaded" class="skeleton" style="height: 200px" />

    <div v-else-if="!swot" class="card empty-state rise">
      <h2>SWOT-анализ ещё не создан</h2>
      <p>Заполните вручную или доверьте первый черновик AI — потом всё можно отредактировать.</p>
      <div class="actions">
        <button class="btn outline" @click="startManual">Заполнить вручную</button>
        <button class="btn" @click="brief = brand.description; aiModal = true">✦ Сгенерировать с AI</button>
      </div>
    </div>

    <div v-else>
      <div class="toolbar">
        <span v-if="swot.generated_by_ai" class="badge ai-badge">✦ создан AI — отредактируйте под себя</span>
        <span v-else />
        <div class="actions">
          <button class="btn outline sm" @click="brief = brand.description; aiModal = true">✦ Перегенерировать</button>
          <button class="btn soft sm" @click="downloadPdf(`/brands/${brand.id}/swot/pdf/`, `SWOT_${brand.name}.pdf`)">↓ PDF</button>
          <button class="btn sm" :disabled="saving" @click="save">{{ saving ? 'Сохраняем…' : 'Сохранить' }}</button>
        </div>
      </div>

      <div class="quad">
        <section v-for="s in sections" :key="s.key" class="card sec rise" :class="s.tone">
          <h3>{{ s.title }}</h3>
          <p class="section-hint">{{ s.hint }}</p>
          <TransitionGroup name="flip" tag="div" class="items">
            <div v-for="(item, i) in swot[s.key]" :key="s.key + i" class="item flip-move">
              <textarea
                v-model="swot[s.key][i]" class="textarea line" rows="1"
                @input="$event.target.style.height = 'auto'; $event.target.style.height = $event.target.scrollHeight + 'px'"
              />
              <button class="btn ghost sm" title="Удалить" @click="swot[s.key].splice(i, 1)">✕</button>
            </div>
          </TransitionGroup>
          <button class="btn ghost sm add" @click="swot[s.key].push('')">+ Добавить пункт</button>
        </section>
      </div>
    </div>

    <AppModal :open="aiModal" title="AI-генерация SWOT" @close="aiModal = false">
      <div class="ai-guide">
        <strong>Чтобы анализ был точным</strong>
        <span>Добавьте аудиторию, главных конкурентов, географию, цены и текущую проблему бренда.</span>
        <span>Результат будет сформирован на узбекском языке латиницей.</span>
      </div>
      <label class="field">Краткое описание бренда</label>
      <textarea v-model="brief" class="textarea" rows="5"
        placeholder="Чем занимается бренд, аудитория, конкуренты, особенности…" />
      <div class="brief-meta"><span>Можно редактировать результат перед сохранением</span><span>{{ brief.length }} символов</span></div>
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
.empty-state p { color: var(--muted); font-size: 0.9rem; margin-bottom: 20px; }
.actions { display: inline-flex; gap: 10px; }

.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.ai-badge { background: var(--violet-soft); color: var(--violet); }

.quad { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sec { padding: 16px 18px; border-top: 4px solid transparent; }
.sec.green { border-top-color: var(--green); }
.sec.red { border-top-color: var(--red); }
.sec.sky { border-top-color: var(--sky); }
.sec.amber { border-top-color: var(--amber); }
.sec h3 { font-size: 0.94rem; margin-bottom: 10px; }
.section-hint { color: var(--muted); font-size: 0.76rem; margin: -5px 0 11px; line-height: 1.4; }

.items { position: relative; display: flex; flex-direction: column; gap: 7px; }
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
  animation: spin 600ms linear infinite; /* быстрый спиннер = ощущение скорости */
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) { .quad { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .empty-state { padding: 28px 18px; }
  .actions { width: 100%; flex-direction: column; }
  .toolbar { align-items: stretch; flex-direction: column; gap: 10px; }
  .toolbar > div { display: flex; flex-wrap: wrap; gap: 8px; }
  .quad { gap: 10px; }
  .sec { padding: 14px; border-top-width: 3px; }
  .item .btn { flex: 0 0 38px; width: 38px; min-height: 38px; padding: 0; }
}
</style>
