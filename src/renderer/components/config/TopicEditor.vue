<template>
  <div class="topic-editor">
    <h3>主题管理</h3>

    <div class="topics-list">
      <div v-for="topic in configStore.topics" :key="topic.id" class="topic-item">
        <div v-if="editingId === topic.id" class="topic-edit">
          <div class="form-field">
            <label class="field-label">主题名称</label>
            <input v-model="editForm.name" placeholder="输入主题名称" class="edit-input" />
          </div>
          <div class="form-field">
            <label class="field-label">关键词（逗号分隔）</label>
            <input v-model="keywordsInput" placeholder="例如：深度学习, 计算机视觉, Transformer" class="edit-input" />
          </div>
          <div class="edit-actions">
            <button @click="saveEdit(topic.id)" class="btn-save">保存</button>
            <button @click="cancelEdit" class="btn-cancel">取消</button>
          </div>
        </div>
        <div v-else class="topic-display">
          <div class="topic-info">
            <span class="topic-name">{{ topic.name }}</span>
            <span class="topic-keywords">{{ topic.keywords.join(', ') }}</span>
          </div>
          <div class="topic-actions">
            <button @click="startEdit(topic)" class="btn-action">编辑</button>
            <button @click="deleteTopic(topic.id)" class="btn-action delete">删除</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isAdding" class="topic-add">
      <div class="form-field">
        <label class="field-label">主题名称</label>
        <input v-model="newTopic.name" placeholder="输入主题名称" class="edit-input" />
      </div>
      <div class="form-field">
        <label class="field-label">关键词（逗号分隔）</label>
        <input v-model="newKeywords" placeholder="例如：深度学习, 计算机视觉, Transformer" class="edit-input" />
      </div>
      <div class="edit-actions">
        <button @click="saveNew" class="btn-save">保存</button>
        <button @click="cancelAdd" class="btn-cancel">取消</button>
      </div>
    </div>

    <button v-else @click="startAdd" class="btn-add">+ 添加主题</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useConfigStore } from '../../stores/config'
import type { Topic } from '../../types/config'

const configStore = useConfigStore()

const editingId = ref<number | null>(null)
const isAdding = ref(false)
const editForm = ref({ name: '', keywords: [] as string[] })
const keywordsInput = ref('')
const newTopic = ref({ name: '', keywords: [] as string[] })
const newKeywords = ref('')

const startEdit = (topic: Topic) => {
  editingId.value = topic.id
  editForm.value = { name: topic.name, keywords: [...topic.keywords] }
  keywordsInput.value = topic.keywords.join(', ')
}

const saveEdit = async (id: number) => {
  if (!editForm.value.name.trim()) return
  try {
    await configStore.updateTopic(id, {
      name: editForm.value.name,
      keywords: keywordsInput.value.split(',').map(k => k.trim()).filter(Boolean),
    })
    editingId.value = null
  } catch (err) {
    console.error('Failed to update topic:', err)
  }
}

const cancelEdit = () => {
  editingId.value = null
}

const startAdd = () => {
  isAdding.value = true
  newTopic.value = { name: '', keywords: [] }
  newKeywords.value = ''
}

const saveNew = async () => {
  if (!newTopic.value.name.trim()) return
  try {
    await configStore.addTopic({
      name: newTopic.value.name,
      keywords: newKeywords.value.split(',').map(k => k.trim()).filter(Boolean),
      enabled: true,
    })
    isAdding.value = false
  } catch (err) {
    console.error('Failed to add topic:', err)
  }
}

const cancelAdd = () => {
  isAdding.value = false
}

const deleteTopic = async (id: number) => {
  try {
    await configStore.deleteTopic(id)
  } catch (err) {
    console.error('Failed to delete topic:', err)
  }
}
</script>

<style scoped>
.topic-editor {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.topic-editor h3 {
  margin-bottom: 12px;
  font-size: 16px;
}

.topics-list {
  margin-bottom: 8px;
}

.topic-item {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.topic-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.topic-info {
  flex: 1;
  min-width: 0;
}

.topic-name {
  display: block;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 2px;
}

.topic-keywords {
  display: block;
  font-size: 13px;
  color: #6b7280;
}

.topic-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-action {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  color: #4b5563;
}

.btn-action:hover {
  background: #f3f4f6;
}

.btn-action.delete:hover {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.topic-edit,
.topic-add {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.edit-input {
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 14px;
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
  background: #2563eb;
  color: white;
  border: none;
}

.btn-cancel {
  background: #ffffff;
  border: 1px solid #e8e8e8;
}

.btn-add {
  background: #ffffff;
  border: 1px dashed #d1d5db;
  color: #6b7280;
  width: 100%;
}

.btn-add:hover {
  border-color: #2563eb;
  color: #2563eb;
}
</style>
