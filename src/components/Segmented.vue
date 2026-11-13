<script setup lang="ts">
export interface SegmentedItem {
  value: string
  label: string
}

defineProps<{ modelValue: string; items: SegmentedItem[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="segmented" role="tablist">
    <button
      v-for="item in items"
      :key="item.value"
      role="tab"
      class="seg"
      :class="{ active: item.value === modelValue }"
      :aria-selected="item.value === modelValue"
      :data-testid="`seg-${item.value}`"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  gap: 2px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px;
}

.seg {
  border: 0;
  background: transparent;
  border-radius: 7px;
  height: 26px;
  padding: 0 12px;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-2);
  transition: background 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;
}

.seg:hover {
  color: var(--text);
}

.seg.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-xs);
}
</style>
