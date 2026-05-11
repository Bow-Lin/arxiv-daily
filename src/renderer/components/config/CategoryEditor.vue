<template>
  <div class="category-editor">
    <h3>抓取分类</h3>
    <p class="hint">管理从 arXiv 抓取论文的分类（如 cs.CV, cs.RO）</p>

    <div class="category-tags">
      <span v-if="configStore.categories.length === 0" class="empty-hint">未设置抓取分类</span>
      <span
        v-for="cat in configStore.categories"
        :key="cat.id"
        class="category-tag"
      >
        {{ cat.name }}
        <span class="tag-remove" @click.stop="deleteCategory(cat.id)"><X :size="12" /></span>
      </span>
    </div>

    <button @click="startAdd" class="btn-add">添加分类</button>

    <!-- Add category dialog -->
    <div v-if="isAdding" class="dialog-overlay" @click.self="isAdding = false">
      <div class="dialog">
        <h4 class="dialog-title">添加分类</h4>
        <div class="form-field">
          <label class="field-label">分类名称（例如：cs.AI，多个分类使用逗号隔开）</label>
          <input v-model="newCategoryName" placeholder="" class="edit-input" @keyup.enter="saveNew" />
        </div>
        <div class="edit-actions">
          <button @click="saveNew" class="btn-save">添加</button>
          <button @click="isAdding = false" class="btn-cancel">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import { useConfigStore } from '../../stores/config'

const configStore = useConfigStore()
const isAdding = ref(false)
const newCategoryName = ref('')

const startAdd = () => {
  newCategoryName.value = ''
  isAdding.value = true
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
  const names = newCategoryName.value.split(',').map(s => s.trim()).filter(Boolean)
  if (names.length === 0) return
  try {
    for (const name of names) {
      await configStore.addCategory(name)
    }
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

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  padding: 12px;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}

.category-tag {
  display: inline-flex;
  align-items: center;
  position: relative;
  padding: 8px 16px;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: default;
}

.empty-hint {
  font-size: 14px;
  color: var(--text-tertiary);
}

.category-tag:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tag-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  opacity: 0;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: opacity 0.15s;
}

.category-tag:hover .tag-remove {
  opacity: 1;
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.tag-remove:hover {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.edit-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 14px;
  height: 36px;
  box-sizing: border-box;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.btn-save,
.btn-cancel,
.btn-add {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-save {
  background: var(--color-primary);
  color: white;
  border: none;
}

.btn-cancel {
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
}

.btn-add {
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  color: var(--text-secondary);
}

.btn-add:hover {
  background: var(--bg-tertiary);
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
}
</style>
