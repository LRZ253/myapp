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
  gap: 1px;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 2px;
}

.seg {
  border: 0;
  background: transparent;
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--text-2);
}

.seg.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 500;
  box-shadow: 0 0 0 0.5px var(--border);
}
</style>
