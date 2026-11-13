<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

withDefaults(defineProps<{ label?: string; pendingLabel?: string }>(), {
  label: '删除',
  pendingLabel: '再点一次',
})

const emit = defineEmits<{ confirm: [] }>()

const pending = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function handleClick() {
  if (!pending.value) {
    pending.value = true
    timer = setTimeout(() => {
      pending.value = false
      timer = null
    }, 2000)
    return
  }
  if (timer) clearTimeout(timer)
  timer = null
  pending.value = false
  emit('confirm')
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <button
    class="btn ghost inline-delete"
    :class="{ pending }"
    data-testid="inline-delete"
    :data-pending="pending ? 'true' : 'false'"
    @click.stop="handleClick"
  >
    {{ pending ? pendingLabel : label }}
  </button>
</template>

<style scoped>
.inline-delete {
  color: var(--text-3);
  padding: 2px 6px;
}

.inline-delete:hover {
  color: var(--danger);
}

.inline-delete.pending {
  color: var(--danger);
  background: var(--danger-soft);
}
</style>
