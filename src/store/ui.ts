import { markRaw, reactive, type Component } from 'vue'
import { db, patch } from './db'

export interface DrawerPayload {
  title: string
  component: Component
  props?: Record<string, unknown>
}

export const ui = reactive({
  drawer: null as DrawerPayload | null,
  paletteOpen: false,
  toastText: '',
  toastVisible: false,
})

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function openDrawer(payload: DrawerPayload): void {
  ui.drawer = { ...payload, component: markRaw(payload.component) }
}

export function closeDrawer(): void {
  ui.drawer = null
}

export function toast(text: string): void {
  ui.toastText = text
  ui.toastVisible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    ui.toastVisible = false
  }, 1500)
}

export function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export function currentTheme(): 'light' | 'dark' {
  return db.doc.settings.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: 'light' | 'dark'): void {
  applyTheme(theme)
  patch((doc) => {
    doc.settings.theme = theme
  })
}

export function toggleTheme(): void {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark')
}
