<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { db, patch } from '@/store/db'
import { addMemo, findMemo, removeMemo, updateMemo } from './memoLogic'
import { closeDrawer, toast } from '@/store/ui'
import InlineDelete from '@/components/InlineDelete.vue'

const props = defineProps<{ memoId?: string | null }>()

const existing = computed(() => (props.memoId ? findMemo(db.doc, props.memoId) : undefined))
const text = ref(existing.value?.content || '')
const area = ref<HTMLTextAreaElement | null>(null)

onMounted(async () => {
  await nextTick()
  area.value?.focus()
})

function save() {
  const value = text.value.trim()
  if (!value) return
  if (existing.value) {
    const id = existing.value.id
    patch((doc) => updateMemo(doc, id, value))
  } else {
    patch((doc) => addMemo(doc, value))
  }
  toast('已保存')
  closeDrawer()
}

function remove() {
  if (!existing.value) return
  const id = existing.value.id
  patch((doc) => removeMemo(doc, id))
  closeDrawer()
}
</script>

<template>
  <div class="memo-drawer">
    <textarea
      ref="area"
      v-model="text"
      rows="6"
      placeholder="想到什么先扔进来，Ctrl + Enter 保存"
      data-testid="memo-textarea"
      @keydown.ctrl.enter="save"
      @keydown.meta.enter="save"
    />
    <div class="row" style="margin-top: 10px">
      <button class="btn primary" data-testid="memo-save" @click="save">保存</button>
      <span class="spacer" />
      <InlineDelete v-if="existing" label="删除备忘" @confirm="remove" />
    </div>
  </div>
</template>
