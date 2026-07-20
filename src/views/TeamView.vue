<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../api'
import AppModal from '../components/AppModal.vue'
import AppIcon from '../components/AppIcon.vue'
import UserAvatar from '../components/UserAvatar.vue'
import KhanCoinIcon from '../components/KhanCoinIcon.vue'
import { ROLE, fmtDate } from '../labels'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const users = ref(null)
const workload = ref(null)
const viewMode = ref('team')
const isAdmin = computed(() => auth.user?.role === 'admin')
const visibleUsers = computed(() => {
  if (!users.value) return []
  return auth.user?.role === 'pm'
    ? users.value.filter((user) => user.role === 'employee')
    : users.value
})
const modal = ref(false)
const saving = ref(false)
const error = ref('')

// --- статистика сотрудника ---
const stats = ref(null)
const maxMonthly = ref(1)

async function openStats(user) {
  const { data } = await api.get(`/users/${user.id}/stats/`)
  maxMonthly.value = Math.max(1, ...data.monthly.map((m) => m.done))
  stats.value = data
}

function fmtCoins(v) {
  return Number(v || 0).toLocaleString('ru-RU')
}
function barH(v) {
  return Math.max(4, Math.round((v / maxMonthly.value) * 64)) + 'px'
}
function effClass(v) {
  if (v === null || v === undefined) return ''
  return v >= 80 ? 'green' : v >= 50 ? 'amber' : 'red'
}

const workloadLabels = {
  available: 'Свободен', balanced: 'Оптимально', high: 'Высокая', overloaded: 'Перегружен',
}
function workloadTone(level) {
  return { available: 'green', balanced: 'blue', high: 'amber', overloaded: 'red' }[level]
}

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6']
const blank = {
  username: '', password: '', first_name: '', last_name: '', email: '',
  role: 'employee', position: '', phone: '', telegram_chat_id: '',
  avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
}
const form = reactive({ ...blank })

async function load() {
  const [usersResponse, workloadResponse] = await Promise.all([
    api.get('/users/'), api.get('/users/workload/'),
  ])
  users.value = usersResponse.data
  workload.value = workloadResponse.data
}
onMounted(load)

async function save() {
  if (!isAdmin.value) return
  saving.value = true
  error.value = ''
  try {
    await api.post('/users/', form)
    modal.value = false
    Object.assign(form, blank, { avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)] })
    await load()
  } catch (e) {
    const data = e.response?.data
    error.value = data ? Object.values(data).flat().join(' ') : 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="head">
      <div><h1 class="page-title" style="margin: 0">Команда</h1><p>Статистика и текущая загрузка сотрудников</p></div>
      <div class="head-actions"><div class="team-switch"><button :class="{ on: viewMode === 'team' }" @click="viewMode = 'team'">Команда</button><button :class="{ on: viewMode === 'workload' }" @click="viewMode = 'workload'">Загрузка</button></div><button v-if="isAdmin" class="btn" @click="modal = true">+ Сотрудник</button></div>
    </div>

    <div v-if="!users || !workload" class="cards">
      <div v-for="i in 4" :key="i" class="skeleton" style="height: 150px" />
    </div>

    <div v-else-if="viewMode === 'team'" class="cards">
      <div v-for="u in visibleUsers" :key="u.id" class="card person rise" @click="openStats(u)">
        <UserAvatar :user="u" :size="46" />
        <div class="info">
          <strong>{{ u.full_name }}</strong>
          <span class="pos">{{ u.position || '—' }}</span>
          <span class="badge role">{{ ROLE[u.role] }}</span>
        </div>
        <div class="load">
          <span class="num" :class="{ hot: u.active_tasks > 3 }">{{ u.active_tasks }}</span>
          <span class="lbl">активных<br />задач</span>
        </div>
        <div class="contact">
          <span class="coins" :class="{ neg: u.khan_coins < 0 }"><KhanCoinIcon :size="17" /> {{ fmtCoins(u.khan_coins) }}</span>
          <span v-if="u.telegram_chat_id" class="tg"><AppIcon name="send" :size="15" /> Telegram</span>
          <span class="more">Статистика →</span>
        </div>
      </div>
    </div>

    <div v-else class="workload-page">
      <div class="workload-legend"><span><i class="green" /> Свободен</span><span><i class="blue" /> Оптимально</span><span><i class="amber" /> Высокая загрузка</span><span><i class="red" /> Перегружен</span></div>
      <article v-for="row in workload" :key="row.user.id" class="card workload-row" @click="openStats(row.user)">
        <div class="work-person"><UserAvatar :user="row.user" :size="48" /><div><strong>{{ row.user.full_name }}</strong><span>{{ row.user.position || 'Сотрудник' }}</span></div></div>
        <div class="load-meter"><div><span>Загрузка</span><strong :class="workloadTone(row.level)">{{ row.score }}%</strong></div><div class="meter"><i :class="workloadTone(row.level)" :style="{ width: `${row.score}%` }" /></div><small :class="workloadTone(row.level)">{{ workloadLabels[row.level] }}</small></div>
        <div class="work-counters"><span><strong>{{ row.active_tasks }}</strong> задач</span><span><strong>{{ row.active_content }}</strong> контентов</span><span :class="{ danger: row.overdue_tasks + row.overdue_content }"><strong>{{ row.overdue_tasks + row.overdue_content }}</strong> просрочено</span><span><strong>{{ row.week_tasks + row.week_content }}</strong> на 7 дней</span></div>
        <div class="next-work"><strong>Ближайшее</strong><div v-for="deadline in row.next_deadlines.slice(0, 2)" :key="`${deadline.type}-${deadline.title}-${deadline.date}`"><AppIcon :name="deadline.type === 'task' ? 'check' : 'movie'" :size="14" /><span>{{ deadline.title }}</span><time>{{ fmtDate(deadline.date, true) }}</time></div><span v-if="!row.next_deadlines.length" class="no-deadline">Нет ближайших дедлайнов</span></div>
      </article>
      <div v-if="!workload.length" class="card empty-workload">Нет сотрудников в доступных вам проектах</div>
    </div>

    <!-- ===== статистика сотрудника ===== -->
    <AppModal :open="!!stats" :title="stats?.user?.full_name || ''" width="680px" @close="stats = null">
      <div v-if="stats" class="stats-body">
        <div class="coin-hero" :class="{ neg: stats.counters.khan_coins < 0 }">
          <span class="coin-label">Khan Coins</span>
          <span class="coin-value"><KhanCoinIcon :size="24" /> {{ fmtCoins(stats.counters.khan_coins) }}</span>
        </div>

        <div class="grid6">
          <div class="mini"><span class="v">{{ stats.counters.done }}</span><span class="l">Выполнено</span></div>
          <div class="mini"><span class="v">{{ stats.counters.active }}</span><span class="l">Активных</span></div>
          <div class="mini"><span class="v red" v-if="stats.counters.overdue_now">{{ stats.counters.overdue_now }}</span><span class="v" v-else>0</span><span class="l">Просрочено</span></div>
          <div class="mini">
            <span class="v" :class="effClass(stats.counters.efficiency)">{{ stats.counters.efficiency ?? '—' }}<template v-if="stats.counters.efficiency !== null">%</template></span>
            <span class="l">Эффективность</span>
          </div>
          <div class="mini"><span class="v">{{ stats.counters.completion_rate }}%</span><span class="l">Completion rate</span></div>
          <div class="mini"><span class="v">{{ stats.counters.avg_hours }} ч</span><span class="l">Ср. время</span></div>
        </div>

        <h4>История за 6 месяцев</h4>
        <div class="monthly">
          <div v-for="m in stats.monthly" :key="m.month" class="month">
            <div class="bars">
              <div class="bar total" :style="{ height: barH(m.done) }" :title="`Выполнено: ${m.done}`" />
              <div class="bar ontime" :style="{ height: barH(m.on_time) }" :title="`В срок: ${m.on_time}`" />
            </div>
            <span class="m-label">{{ m.month }}</span>
          </div>
        </div>
        <p class="legend"><span class="dot total" /> выполнено <span class="dot ontime" /> из них в срок</p>

        <h4>Khan Coins — история</h4>
        <div class="tx-list">
          <div v-for="(tx, i) in stats.transactions" :key="i" class="tx">
            <span class="tx-amount" :class="tx.amount > 0 ? 'pos' : 'neg'">{{ tx.amount > 0 ? '+' : '' }}{{ fmtCoins(tx.amount) }}</span>
            <div class="tx-info">
              <strong>{{ tx.task_title || tx.reason }}</strong>
              <span>{{ tx.reason }} · {{ fmtDate(tx.created_at, true) }}</span>
            </div>
          </div>
          <p v-if="!stats.transactions.length" class="empty-tx">Начислений пока не было</p>
        </div>
      </div>
      <template #footer>
        <button class="btn outline" @click="stats = null">Закрыть</button>
      </template>
    </AppModal>

    <AppModal :open="modal && isAdmin" title="Новый сотрудник" width="560px" @close="modal = false">
      <div class="form">
        <div class="row2">
          <div><label class="field">Имя</label><input v-model="form.first_name" class="input" /></div>
          <div><label class="field">Фамилия</label><input v-model="form.last_name" class="input" /></div>
        </div>
        <div class="row2">
          <div><label class="field">Логин *</label><input v-model="form.username" class="input" required /></div>
          <div><label class="field">Пароль *</label><input v-model="form.password" type="password" class="input" required /></div>
        </div>
        <div class="row2">
          <div>
            <label class="field">Роль</label>
            <select v-model="form.role" class="select">
              <option v-for="(v, k) in ROLE" :key="k" :value="k">{{ v }}</option>
            </select>
          </div>
          <div><label class="field">Должность</label><input v-model="form.position" class="input" /></div>
        </div>
        <div class="row2">
          <div><label class="field">Email</label><input v-model="form.email" type="email" class="input" /></div>
          <div><label class="field">Телефон</label><input v-model="form.phone" class="input" /></div>
        </div>
        <div>
          <label class="field">Telegram chat_id (для личных уведомлений)</label>
          <input v-model="form.telegram_chat_id" class="input" placeholder="например 123456789" />
        </div>
        <div>
          <label class="field">Цвет аватара</label>
          <div class="colors">
            <button
              v-for="c in COLORS" :key="c" type="button"
              class="color" :class="{ on: form.avatar_color === c }"
              :style="{ background: c }" @click="form.avatar_color = c"
            />
          </div>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
      </div>
      <template #footer>
        <button class="btn outline" @click="modal = false">Отмена</button>
        <button class="btn" :disabled="saving || !form.username || !form.password" @click="save">Создать</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 20px; }
.head p { margin-top: 4px; color: var(--muted); font-size: .8rem; }
.head-actions { display: flex; align-items: center; gap: 10px; }
.team-switch { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--sunken); }
.team-switch button { min-height: 34px; padding: 6px 12px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font: inherit; font-size: .8rem; font-weight: 700; cursor: pointer; }
.team-switch button.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.person { padding: 18px 20px; display: grid; grid-template-columns: auto 1fr auto; gap: 4px 14px; align-items: center; }
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.info strong { font-size: 0.98rem; }
.pos { color: var(--muted); font-size: 0.82rem; }
.role { background: var(--accent-soft); color: var(--accent-ink); align-self: flex-start; margin-top: 3px; }

.load { text-align: center; line-height: 1.1; }
.load .num { display: block; font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.load .num.hot { color: var(--red); }
.load .lbl { font-size: 0.66rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }

.person { cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) ease; }
.person:active { transform: scale(0.985); }
@media (hover: hover) and (pointer: fine) {
  .person:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
}

.contact { grid-column: 1 / -1; display: flex; gap: 14px; flex-wrap: wrap; align-items: center; color: var(--muted); font-size: 0.8rem; padding-top: 8px; border-top: 1px solid var(--line); margin-top: 8px; }
.tg { color: var(--sky); }
.coins { font-weight: 700; color: var(--amber); font-variant-numeric: tabular-nums; }
.coins, .coin-value { display: inline-flex; align-items: center; gap: 6px; }
.coins.neg { color: var(--red); }
.more { margin-left: auto; color: var(--accent); font-weight: 600; }
.workload-page { display: flex; flex-direction: column; gap: 10px; }
.workload-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--muted); font-size: .72rem; }
.workload-legend span { display: inline-flex; align-items: center; gap: 5px; }
.workload-legend i { width: 8px; height: 8px; border-radius: 50%; }
.workload-row { display: grid; grid-template-columns: minmax(190px,.9fr) minmax(180px,.8fr) minmax(250px,1fr) minmax(250px,1.1fr); align-items: center; gap: 18px; padding: 15px 17px; cursor: pointer; }
.work-person { display: flex; align-items: center; gap: 10px; min-width: 0; }
.work-person>div { min-width: 0; }
.work-person>div strong,.work-person>div span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.work-person>div span { margin-top: 3px; color: var(--muted); font-size: .72rem; }
.work-person :deep(.avatar) { display: inline-flex; flex: 0 0 48px; border: 3px solid var(--surface-solid); box-shadow: 0 0 0 1px var(--line), 0 4px 12px rgb(0 0 0 / .08); }
.load-meter>div:first-child { display: flex; justify-content: space-between; color: var(--muted); font-size: .72rem; }
.load-meter strong { font-size: .82rem; }.load-meter small { display: block; margin-top: 4px; font-size: .66rem; font-weight: 700; }
.meter { height: 7px; margin-top: 6px; overflow: hidden; border-radius: 99px; background: var(--sunken); }.meter i { display: block; height: 100%; border-radius: inherit; transition: width 400ms var(--ease-out); }
.green { color: var(--green)!important; }.blue { color: var(--sky)!important; }.amber { color: var(--amber)!important; }.red { color: var(--red)!important; }
.meter .green,.workload-legend .green { background: var(--green); }.meter .blue,.workload-legend .blue { background: var(--sky); }.meter .amber,.workload-legend .amber { background: var(--amber); }.meter .red,.workload-legend .red { background: var(--red); }
.work-counters { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 10px; }.work-counters span { color: var(--muted); font-size: .7rem; }.work-counters strong { color: var(--ink); font-size: .82rem; }.work-counters .danger,.work-counters .danger strong { color: var(--red); }
.next-work { min-width: 0; }.next-work>strong { display: block; margin-bottom: 5px; color: var(--muted); font-size: .68rem; text-transform: uppercase; }.next-work>div { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 6px; padding: 2px 0; font-size: .7rem; }.next-work>div span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.next-work time { color: var(--muted); white-space: nowrap; }.no-deadline { color: var(--green); font-size: .72rem; }.empty-workload { padding: 30px; color: var(--muted); text-align: center; }

/* ---- модалка статистики ---- */
.coin-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--amber) 14%, transparent);
  margin-bottom: 14px;
}
.coin-hero.neg { background: var(--red-soft); }
.coin-label { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--amber); }
.coin-hero.neg .coin-label { color: var(--red); }
.coin-value { font-size: 1.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.coin-hero.neg .coin-value { color: var(--red); }

.grid6 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mini {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}
.mini .v { font-size: 1.2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.mini .v.green { color: var(--green); }
.mini .v.amber { color: var(--amber); }
.mini .v.red { color: var(--red); }
.mini .l { font-size: 0.72rem; color: var(--muted); font-weight: 600; }

.stats-body h4 { font-size: 0.88rem; color: var(--ink-2); margin: 18px 0 10px; }

.monthly { display: flex; gap: 12px; align-items: flex-end; }
.month { flex: 1; text-align: center; }
.bars { display: flex; gap: 3px; align-items: flex-end; justify-content: center; height: 68px; }
.bar { width: 14px; border-radius: 4px 4px 2px 2px; transition: height 400ms var(--ease-in-out); }
.bar.total { background: var(--accent-soft); }
.bar.ontime { background: var(--green); }
.m-label { font-size: 0.7rem; color: var(--muted); }
.legend { font-size: 0.76rem; color: var(--muted); margin-top: 8px; display: flex; gap: 6px; align-items: center; }
.legend .dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.legend .dot.total { background: var(--accent-soft); }
.legend .dot.ontime { background: var(--green); }

.tx-list { display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto; }
.tx { display: flex; gap: 12px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); }
.tx-amount { font-weight: 800; font-variant-numeric: tabular-nums; width: 90px; flex: none; }
.tx-amount.pos { color: var(--green); }
.tx-amount.neg { color: var(--red); }
.tx-info { min-width: 0; line-height: 1.3; }
.tx-info strong { display: block; font-size: 0.86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx-info span { font-size: 0.75rem; color: var(--muted); }
.empty-tx { color: var(--muted); font-size: 0.85rem; padding: 10px; }

.form { display: flex; flex-direction: column; gap: 13px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.colors { display: flex; gap: 8px; }
.color {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform var(--dur-press) var(--ease-out), box-shadow var(--dur-fast) ease;
}
.color:active { transform: scale(0.9); }
.color.on { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink); }
.error { color: var(--red); font-size: 0.85rem; }

@media (max-width: 640px) {
  .head { align-items: stretch; flex-direction: column; gap: 12px; }
  .head-actions { align-items: stretch; flex-direction: column; }.team-switch { width: 100%; }.team-switch button { flex: 1; }
  .head .btn { width: 100%; }
  .cards { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .person { padding: 16px; gap: 4px 10px; }
  .contact { gap: 8px 12px; }
  .more { width: 100%; margin-left: 0; }
  .coin-hero { align-items: flex-start; flex-direction: column; gap: 4px; }
  .grid6 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .monthly { gap: 6px; }
  .tx { align-items: flex-start; flex-direction: column; gap: 2px; }
  .tx-amount { width: auto; }
  .row2 { grid-template-columns: 1fr; }
  .color { width: 32px; height: 32px; }
  .workload-row { grid-template-columns: 1fr; gap: 13px; padding: 15px; }.work-counters { padding: 10px; border-radius: 10px; background: var(--sunken); }
  .work-person :deep(.avatar) { flex-basis: 46px; width: 46px!important; height: 46px!important; }
}
@media (min-width: 641px) and (max-width: 1100px) { .workload-row { grid-template-columns: 1fr 1fr; }.next-work { grid-column: 1/-1; } }
</style>
