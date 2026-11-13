<script setup lang="ts">
import { computed, ref } from 'vue'
import { db, patch } from '@/store/db'
import { toast } from '@/store/ui'
import type { MealType } from '@/types'
import { MEAL_TYPES, addDish, planOf, toggleMealDish } from './dietLogic'

const props = defineProps<{ date: string; mealType: MealType }>()

const newDish = ref('')
const newCalories = ref<number | null>(null)

const mealLabel = computed(() => MEAL_TYPES.find((m) => m.key === props.mealType)?.label || '')
const selected = computed(() => planOf(db.doc, props.date, props.mealType)?.dishIds || [])
const dishes = computed(() => db.doc.dishes)

function toggle(id: string) {
  patch((doc) => toggleMealDish(doc, props.date, props.mealType, id))
}

function add() {
  const name = newDish.value.trim()
  if (!name) return
  let id = ''
  patch((doc) => {
    const dish = addDish(doc, name, props.mealType, Number(newCalories.value) || 0)
    if (dish) {
      id = dish.id
      toggleMealDish(doc, props.date, props.mealType, id)
    }
  })
  newDish.value = ''
  newCalories.value = null
  toast('已加入这一餐')
}
</script>

<template>
  <div class="meal-picker">
    <p class="hint">{{ date }} · {{ mealLabel }}</p>

    <div class="dish-list">
      <label v-for="dish in dishes" :key="dish.id" class="dish-item">
        <input type="checkbox" :checked="selected.includes(dish.id)" :data-testid="`meal-pick-${dish.id}`" @change="toggle(dish.id)" />
        <span>{{ dish.name }}</span>
        <span class="hint">{{ dish.calories ? `${dish.calories} 千卡` : '未填热量' }}</span>
      </label>
      <p v-if="!dishes.length" class="hint">菜品库还是空的，下面加一个。</p>
    </div>

    <div class="add-row">
      <input v-model="newDish" placeholder="新菜品" data-testid="meal-new-dish" @keydown.enter="add" />
      <input v-model.number="newCalories" type="number" min="0" placeholder="千卡" class="cal" />
      <button class="btn" data-testid="meal-add-dish" @click="add">加</button>
    </div>
  </div>
</template>

<style scoped>
.meal-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dish-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow: auto;
}

.dish-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.dish-item input {
  width: auto;
}

.dish-item .hint {
  margin-left: auto;
}

.add-row {
  display: flex;
  gap: 6px;
}

.cal {
  width: 76px;
}
</style>
