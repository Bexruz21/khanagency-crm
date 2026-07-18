import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/brands', name: 'brands', component: () => import('../views/BrandsView.vue'), meta: { managerOnly: true } },
  { path: '/brands/:id', name: 'brand', component: () => import('../views/BrandDetailView.vue'), meta: { managerOnly: true } },
  { path: '/finances', name: 'finances', component: () => import('../views/FinanceView.vue'), meta: { managerOnly: true } },
  { path: '/finances/:brandId', name: 'finance-brand', component: () => import('../views/FinanceView.vue'), meta: { managerOnly: true } },
  { path: '/tasks', name: 'tasks', component: () => import('../views/TasksView.vue') },
  { path: '/tasks/archive', name: 'task-archive', component: () => import('../views/TaskArchiveView.vue') },
  { path: '/my-content', name: 'my-content', component: () => import('../views/MyContentView.vue') },
  { path: '/my-content/:brandId', name: 'my-content-brand', component: () => import('../views/MyContentView.vue') },
  { path: '/team', name: 'team', component: () => import('../views/TeamView.vue'), meta: { managerOnly: true } },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const hasToken = !!localStorage.getItem('khan_access')
  const auth = useAuthStore()

  if (!hasToken) {
    auth.initialized = true
    if (!to.meta.public) return { name: 'login' }
    return true
  }

  try {
    await auth.ensureSession()
  } catch {
    return to.name === 'login' ? true : { name: 'login' }
  }

  if (to.name === 'login') return { name: 'dashboard' }
  if (to.meta.managerOnly && auth.user?.role === 'employee') return { name: 'dashboard' }
  return true
})

export default router
