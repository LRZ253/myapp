import { createRouter, createWebHistory, createMemoryHistory, type RouterHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Today from '@/views/Today.vue'
import Media from '@/views/Media.vue'
import Dev from '@/views/Dev.vue'
import Consult from '@/views/Consult.vue'
import Fitness from '@/views/Fitness.vue'
import Diet from '@/views/Diet.vue'
import Play from '@/views/Play.vue'
import Settings from '@/views/Settings.vue'

export interface NavItem {
  path: string
  name: string
  label: string
  badge?: 'today' | 'consult' | 'media'
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', name: 'home', label: '首页' },
  { path: '/today', name: 'today', label: '今日计划', badge: 'today' },
  { path: '/media', name: 'media', label: '自媒体', badge: 'media' },
  { path: '/dev', name: 'dev', label: '开发工作' },
  { path: '/consult', name: 'consult', label: '咨询工作', badge: 'consult' },
  { path: '/fitness', name: 'fitness', label: '健身计划' },
  { path: '/diet', name: 'diet', label: '饮食计划' },
  { path: '/play', name: 'play', label: '游戏娱乐' },
  { path: '/settings', name: 'settings', label: '数据与设置' },
]

export const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/today', name: 'today', component: Today },
  { path: '/media', name: 'media', component: Media },
  { path: '/dev', name: 'dev', component: Dev },
  { path: '/consult', name: 'consult', component: Consult },
  { path: '/fitness', name: 'fitness', component: Fitness },
  { path: '/diet', name: 'diet', component: Diet },
  { path: '/play', name: 'play', component: Play },
  { path: '/settings', name: 'settings', component: Settings },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    history: history || createWebHistory(),
    routes,
  })
}

export function createTestRouter() {
  return createAppRouter(createMemoryHistory())
}
