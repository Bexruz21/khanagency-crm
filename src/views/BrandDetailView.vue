<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import UserAvatar from '../components/UserAvatar.vue'
import SwotTab from '../components/brand/SwotTab.vue'
import StrategyTab from '../components/brand/StrategyTab.vue'
import ContentPlanTab from '../components/brand/ContentPlanTab.vue'
import ReportTab from '../components/brand/ReportTab.vue'
import { BRAND_STATUS, fmtDate, fmtMoney } from '../labels'

const route = useRoute()
const brand = ref(null)
const tab = ref('overview')
const users = ref([])
const projectManagers = computed(() => users.value.filter((user) => ['admin', 'pm'].includes(user.role)))

const tabs = [
  { id: 'overview', label: 'Обзор' },
  { id: 'swot', label: 'SWOT' },
  { id: 'strategy', label: 'Стратегия' },
  { id: 'content', label: 'Контент-план' },
  { id: 'report', label: 'Отчёт' },
]

// --- редактирование ---
const editModal = ref(false)
const saving = ref(false)
const form = reactive({})

// --- подтверждаемое AI-исследование бренда ---
const researchModal = ref(false)
const researching = ref(false)
const confirmingResearch = ref(false)
const researchError = ref('')
const searchHint = ref('')
const researchDraft = ref(null)
const researchSources = ref([])

async function load() {
  const { data } = await api.get(`/brands/${route.params.id}/`)
  brand.value = data
}

onMounted(async () => {
  await load()
  const { data } = await api.get('/users/')
  users.value = data
})

function openEdit() {
  Object.assign(form, {
    name: brand.value.name,
    niche: brand.value.niche,
    description: brand.value.description,
    contact_name: brand.value.contact_name,
    contact_phone: brand.value.contact_phone,
    contact_email: brand.value.contact_email,
    budget: brand.value.budget,
    manager: brand.value.manager,
    members: [...brand.value.members],
    start_date: brand.value.start_date,
    status: brand.value.status,
  })
  editModal.value = true
}

async function saveEdit() {
  saving.value = true
  try {
    await api.patch(`/brands/${brand.value.id}/`, form)
    editModal.value = false
    await load()
  } finally {
    saving.value = false
  }
}

function toggleMember(id) {
  const i = form.members.indexOf(id)
  i === -1 ? form.members.push(id) : form.members.splice(i, 1)
}

function openResearch() {
  searchHint.value = [brand.value.research_data?.website, brand.value.contact_email].filter(Boolean).join(' · ')
  const saved = brand.value.research_data && Object.keys(brand.value.research_data).length
  researchDraft.value = saved ? JSON.parse(JSON.stringify(brand.value.research_data)) : null
  researchSources.value = saved ? [...(brand.value.research_sources || [])] : []
  researchError.value = ''
  researchModal.value = true
}

async function runResearch() {
  researching.value = true
  researchError.value = ''
  try {
    const { data } = await api.post(`/brands/${brand.value.id}/research/`, { search_hint: searchHint.value })
    researchDraft.value = data.draft
    researchSources.value = data.sources || []
  } catch (error) {
    researchError.value = error.response?.data?.detail || 'Не удалось выполнить поиск. Попробуйте уточнить сайт или Instagram бренда.'
  } finally {
    researching.value = false
  }
}

function setResearchList(key, value) {
  researchDraft.value[key] = value.split('\n').map((item) => item.trim()).filter(Boolean)
}

async function confirmResearch() {
  confirmingResearch.value = true
  researchError.value = ''
  try {
    const { data } = await api.post(`/brands/${brand.value.id}/research/confirm/`, {
      draft: researchDraft.value,
      sources: researchSources.value,
    })
    brand.value = data
    researchModal.value = false
  } catch (error) {
    researchError.value = error.response?.data?.detail || 'Не удалось сохранить подтверждённые данные.'
  } finally {
    confirmingResearch.value = false
  }
}
</script>

<template>
  <div v-if="!brand"><div class="skeleton" style="height: 120px" /></div>

  <div v-else>
    <RouterLink to="/brands" class="back">← Все бренды</RouterLink>

    <div class="head rise">
      <div>
        <h1 class="page-title" style="margin-bottom: 4px">{{ brand.name }}</h1>
        <span class="muted">{{ brand.niche }}</span>
      </div>
      <div class="head-actions">
        <StatusBadge :map="BRAND_STATUS" :value="brand.status" />
        <button class="btn outline sm" @click="openEdit">✎ Редактировать</button>
      </div>
    </div>

    <nav class="tabs rise">
      <button
        v-for="t in tabs" :key="t.id"
        class="tab" :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >{{ t.label }}</button>
    </nav>

    <Transition name="page" mode="out-in" :duration="{ enter: 260, leave: 140 }">
      <div v-if="tab === 'overview'" key="overview" class="overview">
        <div class="card panel">
          <div class="panel-heading">
            <div>
              <h2>О бренде</h2>
              <span v-if="brand.researched_at" class="research-date">Данные проверены {{ fmtDate(brand.researched_at) }}</span>
            </div>
            <button class="btn soft sm" @click="openResearch">✦ {{ brand.researched_at ? 'Данные и поиск' : 'Найти данные' }}</button>
          </div>
          <div class="desc-block">
            <p class="desc">{{ brand.description || 'Описание не заполнено — добавьте его: AI использует этот текст для SWOT и стратегии' }}</p>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-icon" style="--tone: var(--violet); --tone-bg: var(--violet-soft)">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 4 7v10l8 5 8-5V7l-8-5zm0 2.3L17.7 8 12 11.6 6.3 8 12 4.3zM6 9.9l5 3.1v6.6l-5-3.1V9.9zm12 6.6-5 3.1V13l5-3.1v6.6z"/></svg>
              </span>
              <div><span class="info-label">Ниша</span><span class="info-value">{{ brand.niche || '—' }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: var(--accent); --tone-bg: var(--accent-soft)">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/></svg>
              </span>
              <div><span class="info-label">Контактное лицо</span><span class="info-value">{{ brand.contact_name || '—' }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: var(--green); --tone-bg: var(--green-soft)">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>
              </span>
              <div><span class="info-label">Телефон</span><span class="info-value">{{ brand.contact_phone || '—' }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: var(--sky); --tone-bg: var(--sky-soft)">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
              </span>
              <div><span class="info-label">Email</span><span class="info-value">{{ brand.contact_email || '—' }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: var(--amber); --tone-bg: var(--amber-soft)">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-1.1c-1.5-.3-2.7-1.2-2.8-2.8h1.9c.1.7.6 1.3 1.9 1.3 1.4 0 1.7-.7 1.7-1.1 0-.6-.3-1.1-1.9-1.5-1.8-.4-3.4-1.1-3.4-3 0-1.4 1.1-2.3 2.6-2.7V5h2v1.2c1.6.4 2.4 1.6 2.5 2.8h-1.9c0-.7-.4-1.3-1.6-1.3-1.1 0-1.6.5-1.6 1.1 0 .5.4.9 1.9 1.3 1.6.4 3.4 1 3.4 3.1 0 1.5-1.1 2.4-2.7 2.7V17z"/></svg>
              </span>
              <div><span class="info-label">Бюджет</span><span class="info-value">{{ fmtMoney(brand.budget) }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: var(--violet); --tone-bg: var(--violet-soft)">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5zm3 5h3v3H8v-3z"/></svg>
              </span>
              <div><span class="info-label">Дата начала</span><span class="info-value">{{ fmtDate(brand.start_date) }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: var(--red); --tone-bg: var(--red-soft)">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              </span>
              <div>
                <span class="info-label">Договор</span>
                <span class="info-value">
                  <a v-if="brand.contract" :href="brand.contract" target="_blank">Скачать файл ↓</a>
                  <template v-else>не загружен</template>
                </span>
              </div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: var(--accent); --tone-bg: var(--accent-soft)">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a9 9 0 1 0 8.9 10.5c.1-.6-.4-1-.9-1s-.9.5-1 1A7 7 0 1 1 13 5v3l4.5-4L13 0v3z"/></svg>
              </span>
              <div><span class="info-label">Статус проекта</span><span class="info-value"><StatusBadge :map="BRAND_STATUS" :value="brand.status" /></span></div>
            </div>
          </div>
        </div>

        <div class="card panel">
          <h2>Команда</h2>
          <div v-if="brand.manager_detail" class="member">
            <UserAvatar :user="brand.manager_detail" :size="34" />
            <div><strong>{{ brand.manager_detail.full_name }}</strong><span class="muted">Project Manager</span></div>
          </div>
          <div v-for="m in brand.members_detail.filter(m => m.id !== brand.manager)" :key="m.id" class="member">
            <UserAvatar :user="m" :size="34" />
            <div><strong>{{ m.full_name }}</strong><span class="muted">{{ m.position }}</span></div>
          </div>
          <button class="btn ghost sm" style="margin-top: 8px" @click="openEdit">+ Изменить состав</button>
        </div>
      </div>

      <SwotTab v-else-if="tab === 'swot'" key="swot" :brand="brand" />
      <StrategyTab v-else-if="tab === 'strategy'" key="strategy" :brand="brand" />
      <ContentPlanTab v-else-if="tab === 'content'" key="content" :brand="brand" />
      <ReportTab v-else key="report" :brand="brand" />
    </Transition>

    <!-- ===== редактирование бренда ===== -->
    <AppModal :open="editModal" title="Редактировать бренд" width="620px" @close="editModal = false">
      <div class="form">
        <div class="row2">
          <div><label class="field">Название *</label><input v-model="form.name" class="input" /></div>
          <div>
            <label class="field">Статус проекта</label>
            <select v-model="form.status" class="select">
              <option v-for="(v, k) in BRAND_STATUS" :key="k" :value="k">{{ v.label }}</option>
            </select>
          </div>
        </div>
        <div class="row2">
          <div><label class="field">Ниша</label><input v-model="form.niche" class="input" /></div>
          <div><label class="field">Бюджет (сум)</label><input v-model="form.budget" type="number" class="input" /></div>
        </div>
        <div><label class="field">Описание</label><textarea v-model="form.description" class="textarea" rows="3" /></div>
        <div class="row2">
          <div><label class="field">Контактное лицо</label><input v-model="form.contact_name" class="input" /></div>
          <div><label class="field">Телефон</label><input v-model="form.contact_phone" class="input" /></div>
        </div>
        <div class="row2">
          <div><label class="field">Email</label><input v-model="form.contact_email" type="email" class="input" /></div>
          <div><label class="field">Дата начала</label><input v-model="form.start_date" type="date" class="input" /></div>
        </div>
        <div>
          <label class="field">Project Manager</label>
          <select v-model="form.manager" class="select">
            <option :value="null">—</option>
            <option v-for="u in projectManagers" :key="u.id" :value="u.id">{{ u.full_name }}</option>
          </select>
        </div>
        <div>
          <label class="field">Команда проекта</label>
          <div class="chips">
            <button
              v-for="u in users" :key="u.id" type="button"
              class="chip" :class="{ on: form.members?.includes(u.id) }"
              @click="toggleMember(u.id)"
            >{{ u.full_name }}</button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn outline" @click="editModal = false">Отмена</button>
        <button class="btn" :disabled="saving || !form.name" @click="saveEdit">
          {{ saving ? 'Сохраняем…' : 'Сохранить' }}
        </button>
      </template>
    </AppModal>

    <AppModal :open="researchModal" title="Поиск данных о бренде" width="820px" @close="researchModal = false">
      <div v-if="!researchDraft" class="research-start">
        <div class="research-hero">
          <span class="research-icon">✦</span>
          <div>
            <h3>AI изучит открытые источники</h3>
            <p>Будут проверены официальный сайт, социальные сети, каталоги и публикации. Результат появится как черновик на узбекском языке латиницей и не изменит бренд без вашего подтверждения.</p>
          </div>
        </div>
        <label class="field">Сайт, Instagram или уточнение для поиска</label>
        <textarea v-model="searchHint" class="textarea" rows="3" placeholder="Например: instagram.com/brand, Ташкент, магазин мужской одежды…" />
        <p class="research-note">Чем точнее ссылка или город, тем меньше риск перепутать бренды с одинаковым названием.</p>
        <p v-if="researchError" class="research-error">{{ researchError }}</p>
      </div>

      <div v-else class="research-review">
        <div class="review-banner">
          <div><strong>Проверьте найденные данные</strong><span>Отредактируйте любые поля и только затем подтвердите.</span></div>
          <span class="confidence" :class="researchDraft.confidence">Точность: {{ researchDraft.confidence }}</span>
        </div>

        <section class="research-section">
          <h3>Основная информация</h3>
          <div class="row2">
            <div><label class="field">Ниша</label><input v-model="researchDraft.niche" class="input" /></div>
            <div><label class="field">География</label><input v-model="researchDraft.geography" class="input" /></div>
          </div>
          <div><label class="field">Краткое резюме</label><textarea v-model="researchDraft.summary" class="textarea" rows="3" /></div>
          <div><label class="field">Подробное описание для SWOT и стратегии</label><textarea v-model="researchDraft.description" class="textarea" rows="7" /></div>
        </section>

        <section class="research-section">
          <h3>Рынок и аудитория</h3>
          <div><label class="field">Целевая аудитория</label><textarea v-model="researchDraft.target_audience" class="textarea" rows="4" /></div>
          <div class="row2">
            <div><label class="field">Позиционирование</label><textarea v-model="researchDraft.positioning" class="textarea" rows="3" /></div>
            <div><label class="field">Ценовой сегмент</label><textarea v-model="researchDraft.price_segment" class="textarea" rows="3" /></div>
          </div>
          <div class="row2">
            <div><label class="field">Товары и услуги — по одному в строке</label><textarea class="textarea" rows="5" :value="researchDraft.products_services.join('\n')" @input="setResearchList('products_services', $event.target.value)" /></div>
            <div><label class="field">Конкуренты — по одному в строке</label><textarea class="textarea" rows="5" :value="researchDraft.competitors.join('\n')" @input="setResearchList('competitors', $event.target.value)" /></div>
          </div>
          <div><label class="field">Маркетинговые каналы — по одному в строке</label><textarea class="textarea" rows="4" :value="researchDraft.marketing_channels.join('\n')" @input="setResearchList('marketing_channels', $event.target.value)" /></div>
        </section>

        <section class="research-section">
          <h3>Контакты и площадки</h3>
          <div class="row2">
            <div><label class="field">Сайт</label><input v-model="researchDraft.website" class="input" /></div>
            <div><label class="field">Контактное лицо</label><input v-model="researchDraft.contact_name" class="input" /></div>
          </div>
          <div class="row2">
            <div><label class="field">Телефон</label><input v-model="researchDraft.contact_phone" class="input" /></div>
            <div><label class="field">Email</label><input v-model="researchDraft.contact_email" type="email" class="input" /></div>
          </div>
          <div><label class="field">Социальные сети — по одной ссылке в строке</label><textarea class="textarea" rows="4" :value="researchDraft.social_links.join('\n')" @input="setResearchList('social_links', $event.target.value)" /></div>
        </section>

        <section class="research-section">
          <h3>Факты и ограничения исследования</h3>
          <div class="row2">
            <div><label class="field">Подтверждённые факты</label><textarea class="textarea" rows="5" :value="researchDraft.key_facts.join('\n')" @input="setResearchList('key_facts', $event.target.value)" /></div>
            <div><label class="field">Что нужно проверить вручную</label><textarea class="textarea" rows="5" :value="researchDraft.caveats.join('\n')" @input="setResearchList('caveats', $event.target.value)" /></div>
          </div>
        </section>

        <section class="research-section sources-section">
          <h3>Источники ({{ researchSources.length }})</h3>
          <div v-if="researchSources.length" class="source-list">
            <a v-for="source in researchSources" :key="source.url" :href="source.url" target="_blank" rel="noopener">
              <strong>{{ source.title }}</strong><span>{{ source.url }}</span><small v-if="source.cited_text">{{ source.cited_text }}</small>
            </a>
          </div>
          <p v-else class="research-note">Claude не вернул ссылки. Перед подтверждением особенно внимательно проверьте данные.</p>
        </section>
        <p v-if="researchError" class="research-error">{{ researchError }}</p>
      </div>

      <template #footer>
        <button class="btn outline" @click="researchModal = false">Отмена</button>
        <button v-if="researchDraft" class="btn soft" :disabled="researching" @click="runResearch">{{ researching ? 'Ищем и проверяем…' : '↻ Найти заново' }}</button>
        <button v-if="!researchDraft" class="btn" :disabled="researching" @click="runResearch">
          <span v-if="researching" class="spinner" />{{ researching ? 'Ищем и проверяем…' : '✦ Начать поиск' }}
        </button>
        <button v-else class="btn" :disabled="confirmingResearch" @click="confirmResearch">
          {{ confirmingResearch ? 'Сохраняем…' : 'Подтвердить данные' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.back { color: var(--muted); text-decoration: none; font-size: 0.87rem; font-weight: 600; }
.head { display: flex; justify-content: space-between; align-items: flex-start; margin: 10px 0 18px; }
.head-actions { display: flex; align-items: center; gap: 10px; }
.muted { color: var(--muted); font-size: 0.88rem; }

.tabs {
  display: inline-flex;
  gap: 2px;
  background: var(--sunken);
  border-radius: 11px;
  padding: 3px;
  margin-bottom: 20px;
}
.tab {
  border: 0;
  background: transparent;
  padding: 7px 16px;
  border-radius: 9px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--ink-2);
  cursor: pointer;
  transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease,
              transform var(--dur-press) var(--ease-out), box-shadow var(--dur-fast) ease;
}
.tab:active { transform: scale(0.96); }
.tab.active { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }

.overview { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; align-items: start; }
.panel { padding: 18px 20px; }
.panel h2 { font-size: 1.02rem; margin-bottom: 12px; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.panel-heading h2 { margin-bottom: 2px; }
.research-date { color: var(--green); font-size: 0.72rem; font-weight: 650; }

.desc-block {
  background: var(--accent-soft);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 13px 16px;
  margin-bottom: 18px;
}
.desc { color: var(--ink-2); font-size: 0.92rem; white-space: pre-line; line-height: 1.55; }

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  transition: background-color var(--dur-fast) ease;
}
@media (hover: hover) and (pointer: fine) {
  .info-item:hover { background: var(--sunken); }
}
.info-icon {
  width: 36px; height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--tone-bg);
  color: var(--tone);
}
.info-icon svg { width: 18px; height: 18px; }
.info-label {
  display: block;
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.info-value { font-size: 0.92rem; font-weight: 600; }
.info-value a { color: var(--accent); text-decoration: none; }
@media (max-width: 640px) { .info-grid { grid-template-columns: 1fr; } }

.member { display: flex; align-items: center; gap: 11px; padding: 7px 0; }
.member strong { display: block; font-size: 0.92rem; }
.member .muted { font-size: 0.8rem; }

.form { display: flex; flex-direction: column; gap: 13px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 99px;
  padding: 5px 13px;
  font-size: 0.84rem;
  cursor: pointer;
  transition: transform var(--dur-press) var(--ease-out), background-color var(--dur-fast) ease,
              color var(--dur-fast) ease, border-color var(--dur-fast) ease;
}
.chip:active { transform: scale(0.95); }
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }

.research-start { display: flex; flex-direction: column; gap: 10px; }
.research-hero { display: flex; gap: 13px; padding: 15px; margin-bottom: 4px; border-radius: 14px; background: var(--accent-soft); color: var(--accent-ink); }
.research-icon { display: grid; place-items: center; width: 38px; height: 38px; flex: none; border-radius: 11px; background: var(--accent); color: white; }
.research-hero h3 { margin-bottom: 4px; font-size: 0.98rem; }
.research-hero p { color: var(--ink-2); font-size: 0.83rem; line-height: 1.48; }
.research-note { color: var(--muted); font-size: 0.76rem; line-height: 1.45; }
.research-error { padding: 10px 12px; border-radius: 10px; background: var(--red-soft); color: var(--red); font-size: 0.82rem; }
.research-review { display: flex; flex-direction: column; gap: 12px; }
.review-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 12px; background: var(--amber-soft); }
.review-banner strong, .review-banner span { display: block; }
.review-banner strong { font-size: 0.88rem; margin-bottom: 2px; }
.review-banner div > span { color: var(--ink-2); font-size: 0.78rem; }
.confidence { padding: 5px 9px; flex: none; border-radius: 99px; background: var(--surface); color: var(--amber); font-size: 0.72rem; font-weight: 700; }
.confidence.high { color: var(--green); }
.confidence.low { color: var(--red); }
.research-section { display: flex; flex-direction: column; gap: 11px; padding: 15px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.research-section h3 { font-size: 0.9rem; color: var(--accent-ink); }
.source-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.source-list a { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 10px 11px; border-radius: 11px; background: var(--sunken); color: var(--ink); text-decoration: none; transition: transform 140ms var(--ease-out), background-color 140ms ease; }
.source-list a:active { transform: scale(0.98); }
.source-list strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; }
.source-list span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--accent); font-size: 0.7rem; }
.source-list small { display: -webkit-box; overflow: hidden; color: var(--muted); font-size: 0.7rem; line-height: 1.35; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.spinner { width: 14px; height: 14px; border: 2px solid rgb(255 255 255 / 0.4); border-top-color: #fff; border-radius: 50%; animation: spin 600ms linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (hover: hover) and (pointer: fine) {
  .source-list a:hover { transform: translateY(-1px); background: var(--accent-soft); }
}

@media (max-width: 900px) { .overview { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .head { align-items: stretch; flex-direction: column; gap: 12px; }
  .head-actions { justify-content: space-between; }
  .tabs {
    display: flex;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { flex: 0 0 auto; min-height: 40px; padding-inline: 14px; }
  .overview { gap: 10px; }
  .panel { padding: 16px; }
  .panel-heading { align-items: stretch; flex-direction: column; }
  .panel-heading .btn { width: 100%; }
  .info-grid { gap: 4px; }
  .info-item { padding-inline: 4px; }
  .row2 { grid-template-columns: 1fr; }
  .review-banner { align-items: flex-start; flex-direction: column; }
  .source-list { grid-template-columns: 1fr; }
  .research-section { padding: 13px; }
  .chip { min-height: 38px; }
}
</style>
