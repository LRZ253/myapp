<script setup lang="ts">
defineProps<{ title: string; desc?: string; actionLabel?: string }>()
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty" data-testid="empty-state">
    <div class="empty-title">{{ title }}</div>
    <div v-if="desc" class="empty-desc">{{ desc }}</div>
    <button v-if="actionLabel" class="btn" @click="emit('action')">{{ actionLabel }}</button>
  </div>
</template>
