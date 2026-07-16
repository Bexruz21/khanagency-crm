<script setup>
import { onMounted, reactive, ref } from 'vue'
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
          <h2>О бренде</h2>
          <div class="desc-block">
            <p class="desc">{{ brand.description || 'Описание не заполнено — добавьте его: AI использует этот текст для SWOT и стратегии' }}</p>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-icon" style="--tone: #7c3aed; --tone-bg: #f1eafd">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 4 7v10l8 5 8-5V7l-8-5zm0 2.3L17.7 8 12 11.6 6.3 8 12 4.3zM6 9.9l5 3.1v6.6l-5-3.1V9.9zm12 6.6-5 3.1V13l5-3.1v6.6z"/></svg>
              </span>
              <div><span class="info-label">Ниша</span><span class="info-value">{{ brand.niche || '—' }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: #4f46e5; --tone-bg: #eef0ff">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/></svg>
              </span>
              <div><span class="info-label">Контактное лицо</span><span class="info-value">{{ brand.contact_name || '—' }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: #0d9466; --tone-bg: #e4f7ef">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>
              </span>
              <div><span class="info-label">Телефон</span><span class="info-value">{{ brand.contact_phone || '—' }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: #0369a1; --tone-bg: #e3f3fc">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
              </span>
              <div><span class="info-label">Email</span><span class="info-value">{{ brand.contact_email || '—' }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: #b45309; --tone-bg: #fdf1de">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-1.1c-1.5-.3-2.7-1.2-2.8-2.8h1.9c.1.7.6 1.3 1.9 1.3 1.4 0 1.7-.7 1.7-1.1 0-.6-.3-1.1-1.9-1.5-1.8-.4-3.4-1.1-3.4-3 0-1.4 1.1-2.3 2.6-2.7V5h2v1.2c1.6.4 2.4 1.6 2.5 2.8h-1.9c0-.7-.4-1.3-1.6-1.3-1.1 0-1.6.5-1.6 1.1 0 .5.4.9 1.9 1.3 1.6.4 3.4 1 3.4 3.1 0 1.5-1.1 2.4-2.7 2.7V17z"/></svg>
              </span>
              <div><span class="info-label">Бюджет</span><span class="info-value">{{ fmtMoney(brand.budget) }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: #ec4899; --tone-bg: #fce9f3">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5zm3 5h3v3H8v-3z"/></svg>
              </span>
              <div><span class="info-label">Дата начала</span><span class="info-value">{{ fmtDate(brand.start_date) }}</span></div>
            </div>

            <div class="info-item">
              <span class="info-icon" style="--tone: #dc2626; --tone-bg: #fdeaea">
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
              <span class="info-icon" style="--tone: #4f46e5; --tone-bg: #eef0ff">
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
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }}</option>
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
  .info-item:hover { background: rgb(20 20 40 / 0.03); }
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

@media (max-width: 900px) { .overview { grid-template-columns: 1fr; } }
</style>
