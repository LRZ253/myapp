<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
let lastActive: HTMLElement | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}

onMounted(() => {
  lastActive = document.activeElement as HTMLElement | null
  document.addEventListener('keydown', onKey)
  panel.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (lastActive && typeof lastActive.focus === 'function') lastActive.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="drawer-mask" data-testid="drawer-mask" @click.self="emit('close')">
      <aside class="drawer" role="dialog" :aria-label="title" tabindex="-1" ref="panel" data-testid="drawer">
        <header class="drawer-head">
          <h2 class="drawer-title">{{ title }}</h2>
          <button class="btn ghost" data-testid="drawer-close" @click="emit('close')">关闭 Esc</button>
        </header>
        <div class="drawer-body">
          <slot />
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-mask {
  position: fixed;
  left: var(--nav-w);
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  z-index: 40;
}

.drawer {
  width: var(--drawer-w);
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  outline: none;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.drawer-title {
  font-size: var(--fs-base);
  font-weight: 500;
}

.drawer-body {
  padding: 16px;
  overflow: auto;
  flex: 1;
}
</style>
