import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/brands', name: 'brands', component: () => import('../views/BrandsView.vue'), meta: { managerOnly: true } },
  { path: '/brands/:id', name: 'brand', component: () => import('../views/BrandDetailView.vue'), meta: { managerOnly: true } },
  { path: '/tasks', name: 'tasks', component: () => import('../views/TasksView.vue') },
  { path: '/my-content', name: 'my-content', component: () => import('../views/MyContentView.vue') },
  { path: '/team', name: 'team', component: () => import('../views/TeamView.vue'), meta: { managerOnly: true } },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authed = !!localStorage.getItem('khan_access')
  if (!to.meta.public && !authed) return { name: 'login' }
  if (to.name === 'login' && authed) return { name: 'dashboard' }

  if (to.meta.managerOnly && authed) {
    const auth = useAuthStore()
    if (!auth.user) {
      try { await auth.fetchMe() } catch { return { name: 'login' } }
    }
    if (auth.user?.role === 'employee') return { name: 'dashboard' }
  }
})

export default router
