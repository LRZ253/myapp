<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="page-header">
    <div class="page-heading">
      <h1 class="page-title">{{ title }}</h1>
      <p v-if="subtitle" class="page-sub">{{ subtitle }}</p>
    </div>
    <div class="page-actions">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.page-title {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
}

.page-sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
