<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

withDefaults(defineProps<{ label?: string; pendingLabel?: string; compact?: boolean }>(), {
  label: '删除',
  pendingLabel: '确认删除？',
  compact: false,
})

const emit = defineEmits<{ confirm: [] }>()

const pending = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function reset() {
  if (timer) clearTimeout(timer)
  timer = null
  pending.value = false
}

function handleClick() {
  if (!pending.value) {
    pending.value = true
    timer = setTimeout(reset, 4000)
    return
  }
  reset()
  emit('confirm')
}

onBeforeUnmount(reset)
</script>

<template>
  <button
    type="button"
    class="inline-delete"
    :class="{ pending, compact }"
    data-testid="inline-delete"
    :data-pending="pending ? 'true' : 'false'"
    :aria-label="pending ? '确认删除' : label"
    @click.stop="handleClick"
  >
    <svg v-if="!pending" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4.5 6.8h15" />
      <path d="M9.6 6.8V5.2h4.8v1.6" />
      <path d="M6.6 6.8 7.5 20h9l.9-13.2" />
    </svg>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m5 12.8 4.4 4.4L19 7.6" />
    </svg>
    <span v-if="!compact || pending">{{ pending ? pendingLabel : label }}</span>
  </button>
</template>

<style scoped>
.inline-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  padding: 0 7px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-2);
  font-size: var(--fs-xs);
  line-height: 1;
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
}

.inline-delete svg {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
}

.inline-delete:hover {
  color: var(--danger);
  background: var(--danger-soft);
}

.inline-delete.pending {
  color: #fff;
  background: var(--danger);
  border-color: var(--danger);
  font-weight: 600;
  animation: shake 0.22s ease;
}

.inline-delete.compact {
  width: 24px;
  padding: 0;
}

.inline-delete.compact.pending {
  width: auto;
  padding: 0 8px;
}

@keyframes shake {
  0% { transform: translateX(0); }
  35% { transform: translateX(-2px); }
  70% { transform: translateX(2px); }
  100% { transform: translateX(0); }
}
</style>
