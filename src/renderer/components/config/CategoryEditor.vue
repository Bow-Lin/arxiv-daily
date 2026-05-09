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
      <div class="add-actions">
        <button @click="saveNew" class="btn-save">添加</button>
        <button @click="isAdding = false" class="btn-cancel">取消</button>
      </div>
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
    alert('保存失败: ' + (err instanceof Error ? err.message : String(err)))
  }
}

const deleteCategory = async (catId: number) => {
  try {
    await configStore.deleteCategory(catId)
  } catch (err) {
    console.error('Failed to delete category:', err)
    alert('删除失败: ' + (err instanceof Error ? err.message : String(err)))
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
    alert('保存失败: ' + (err instanceof Error ? err.message : String(err)))
  }
}
</script>

<style scoped>
.category-editor {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.category-editor h3 {
  margin-bottom: 12px;
  font-size: 16px;
}

.hint {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 16px;
}

.category-list {
  margin-bottom: 6px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
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
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-tertiary);
}

.btn-delete:hover {
  background: var(--color-error-bg);
  border-color: var(--color-error-border);
  color: var(--color-error);
}

.category-add {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 14px;
  height: 36px;
  box-sizing: border-box;
}

.add-actions {
  display: flex;
  gap: 8px;
}

.btn-save {
  padding: 8px 16px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-cancel {
  padding: 8px 16px;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-add {
  width: 100%;
  padding: 8px 16px;
  background: var(--card-bg);
  border: 1px dashed var(--border-secondary);
  border-radius: 4px;
  font-size: 14px;
  color: var(--text-tertiary);
  cursor: pointer;
}

.btn-add:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
