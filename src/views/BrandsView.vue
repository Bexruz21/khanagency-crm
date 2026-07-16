<script setup>
import { onMounted, reactive, ref } from 'vue'
import api from '../api'
import AppModal from '../components/AppModal.vue'
import StatusBadge from '../components/StatusBadge.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { BRAND_STATUS, fmtMoney } from '../labels'

const brands = ref(null)
const users = ref([])
const modal = ref(false)
const saving = ref(false)

const form = reactive({
  name: '', niche: '', description: '',
  contact_name: '', contact_phone: '', contact_email: '',
  budget: null, manager: null, members: [], start_date: null, status: 'active',
})

async function load() {
  const [b, u] = await Promise.all([api.get('/brands/'), api.get('/users/')])
  brands.value = b.data
  users.value = u.data
}
onMounted(load)

async function save() {
  saving.value = true
  try {
    await api.post('/brands/', form)
    modal.value = false
    Object.assign(form, { name: '', niche: '', description: '', contact_name: '', contact_phone: '', contact_email: '', budget: null, manager: null, members: [], start_date: null, status: 'active' })
    await load()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="head">
      <h1 class="page-title" style="margin: 0">Бренды</h1>
      <button class="btn" @click="modal = true">+ Новый бренд</button>
    </div>

    <div v-if="!brands" class="cards">
      <div v-for="i in 3" :key="i" class="skeleton" style="height: 180px" />
    </div>

    <div v-else class="cards">
      <RouterLink
        v-for="b in brands" :key="b.id"
        :to="`/brands/${b.id}`" class="card brand-card rise"
      >
        <div class="top">
          <div>
            <h3>{{ b.name }}</h3>
            <span class="niche">{{ b.niche || 'Ниша не указана' }}</span>
          </div>
          <StatusBadge :map="BRAND_STATUS" :value="b.status" />
        </div>

        <p class="desc">{{ b.description || 'Без описания' }}</p>

        <div class="progress"><div class="bar" :style="{ width: b.progress + '%' }" /></div>
        <div class="meta">
          <span>{{ b.tasks_done }}/{{ b.tasks_total }} задач</span>
          <span v-if="b.tasks_overdue" class="overdue">{{ b.tasks_overdue }} просрочено</span>
          <span class="budget">{{ fmtMoney(b.budget) }}</span>
        </div>

        <div class="bottom">
          <div class="avatars">
            <UserAvatar v-for="m in b.members_detail.slice(0, 5)" :key="m.id" :user="m" :size="27" />
          </div>
          <span v-if="b.manager_detail" class="pm">PM: {{ b.manager_detail.full_name }}</span>
        </div>
      </RouterLink>
    </div>

    <AppModal :open="modal" title="Новый бренд" width="600px" @close="modal = false">
      <form class="form" @submit.prevent="save">
        <div class="row2">
          <div><label class="field">Название *</label><input v-model="form.name" class="input" required /></div>
          <div><label class="field">Ниша</label><input v-model="form.niche" class="input" /></div>
        </div>
        <div><label class="field">Описание</label><textarea v-model="form.description" class="textarea" placeholder="Чем занимается бренд — это описание использует AI для SWOT и стратегии" /></div>
        <div class="row2">
          <div><label class="field">Контактное лицо</label><input v-model="form.contact_name" class="input" /></div>
          <div><label class="field">Телефон</label><input v-model="form.contact_phone" class="input" /></div>
        </div>
        <div class="row2">
          <div><label class="field">Email</label><input v-model="form.contact_email" type="email" class="input" /></div>
          <div><label class="field">Бюджет (сум)</label><input v-model="form.budget" type="number" class="input" /></div>
        </div>
        <div class="row2">
          <div>
            <label class="field">Project Manager</label>
            <select v-model="form.manager" class="select">
              <option :value="null">—</option>
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }}</option>
            </select>
          </div>
          <div><label class="field">Дата начала</label><input v-model="form.start_date" type="date" class="input" /></div>
        </div>
        <div>
          <label class="field">Команда проекта</label>
          <div class="chips">
            <button
              v-for="u in users" :key="u.id" type="button"
              class="chip" :class="{ on: form.members.includes(u.id) }"
              @click="form.members.includes(u.id) ? form.members.splice(form.members.indexOf(u.id), 1) : form.members.push(u.id)"
            >{{ u.full_name }}</button>
          </div>
        </div>
      </form>
      <template #footer>
        <button class="btn outline" @click="modal = false">Отмена</button>
        <button class="btn" :disabled="saving || !form.name" @click="save">Создать</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.brand-card {
  display: block;
  padding: 18px 20px;
  text-decoration: none;
  color: inherit;
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) ease;
}
.brand-card:active { transform: scale(0.985); }
@media (hover: hover) and (pointer: fine) {
  .brand-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
}

.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
h3 { font-size: 1.08rem; }
.niche { color: var(--muted); font-size: 0.82rem; }
.desc {
  color: var(--ink-2);
  font-size: 0.86rem;
  margin: 10px 0 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.progress { height: 6px; border-radius: 4px; background: var(--line); overflow: hidden; }
.progress .bar { height: 100%; background: linear-gradient(90deg, var(--accent), #7c6cf5); border-radius: 4px; }
.meta { display: flex; gap: 12px; font-size: 0.79rem; color: var(--muted); margin: 8px 0 14px; }
.overdue { color: var(--red); font-weight: 600; }
.budget { margin-left: auto; }

.bottom { display: flex; align-items: center; justify-content: space-between; }
.avatars { display: flex; }
.avatars > * { margin-right: -7px; border: 2px solid var(--surface); }
.pm { font-size: 0.79rem; color: var(--muted); }

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
</style>
