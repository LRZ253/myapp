<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; eyebrow?: string }>()
</script>

<template>
  <header class="page-header">
    <div class="page-heading">
      <span v-if="eyebrow" class="page-eyebrow">{{ eyebrow }}</span>
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
  gap: 16px;
  padding: 8px 0 22px;
  margin-bottom: 4px;
}

.page-heading {
  min-width: 0;
}

.page-eyebrow {
  display: block;
  font-size: var(--fs-2xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-text);
  margin-bottom: 4px;
}

.page-title {
  font-size: var(--fs-2xl);
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.page-sub {
  font-size: var(--fs-sm);
  color: var(--text-3);
  margin-top: 5px;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .page-actions {
    justify-content: flex-start;
  }
}
</style>
