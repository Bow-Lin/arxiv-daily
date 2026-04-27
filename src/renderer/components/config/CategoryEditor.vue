<template>
  <div class="category-editor">
    <h3>抓取分类</h3>
    <p class="hint">管理从 arXiv 抓取论文的分类（如 cs.CV, cs.RO）</p>

    <div class="category-list">
      <div v-for="cat in configStore.categories" :key="cat.id" class="category-item">
        <div class="category-info">
          <label class="checkbox-label">
            <input type="checkbox" :checked="cat.enabled" @change="toggleCategory(cat)" />
            <span class="category-name">{{ cat.name }}</span>
          </label>
        </div>
        <button @click="deleteCategory(cat.id)" class="btn-delete">删除</button>
      </div>
    </div>

    <div v-if="isAdding" class="category-add">
      <input v-model="newCategoryName" placeholder="例如: cs.AI" class="add-input" @keyup.enter="saveNew" />
      <button @click="saveNew" class="btn-save">添加</button>
      <button @click="isAdding = false" class="btn-cancel">取消</button>
    </div>
    <button v-else @click="isAdding = true; newCategoryName = ''" class="btn-add">+ 添加分类</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useConfigStore } from '../../stores/config'
import type { Category } from '../../types/config'

const configStore = useConfigStore()
const isAdding = ref(false)
const newCategoryName = ref('')

const toggleCategory = async (cat: Category) => {
  try {
    await configStore.updateCategory(cat.id, { enabled: !cat.enabled })
  } catch (err) {
    console.error('Failed to update category:', err)
  }
}

const deleteCategory = async (catId: number) => {
  try {
    await configStore.deleteCategory(catId)
  } catch (err) {
    console.error('Failed to delete category:', err)
  }
}

const saveNew = async () => {
  const name = newCategoryName.value.trim()
  if (!name) return
  try {
    await configStore.addCategory(name)
    isAdding.value = false
    newCategoryName.value = ''
  } catch (err) {
    console.error('Failed to add category:', err)
  }
}
</script>

<style scoped>
.category-editor {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.category-editor h3 {
  margin-bottom: 4px;
  font-size: 16px;
}

.hint {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 16px;
}

.category-list {
  margin-bottom: 16px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  margin-bottom: 6px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.category-name {
  font-size: 14px;
  font-weight: 500;
}

.btn-delete {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  color: #6b7280;
}

.btn-delete:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.category-add {
  display: flex;
  gap: 8px;
}

.add-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 14px;
}

.btn-save {
  padding: 8px 16px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-cancel {
  padding: 8px 16px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-add {
  width: 100%;
  padding: 8px 16px;
  background: #ffffff;
  border: 1px dashed #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
}

.btn-add:hover {
  border-color: #2563eb;
  color: #2563eb;
}
</style>
