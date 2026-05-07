<template>
  <div class="zotero-settings">
    <h3>Zotero 设置</h3>

    <div class="form-row">
      <label>User ID</label>
      <input v-model="configStore.zoteroConfig.user_id" placeholder="数字 ID" @change="save" />
    </div>

    <div class="form-row">
      <label>API Key</label>
      <div class="input-wrapper">
        <input
          v-model="configStore.zoteroConfig.api_key"
          :type="showApiKey ? 'text' : 'password'"
          placeholder="Zotero API Key"
          @change="save"
        />
        <button class="toggle-visibility" @click="showApiKey = !showApiKey">
          <Eye v-if="!showApiKey" :size="16" />
          <EyeOff v-else :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { useConfigStore } from '../../stores/config'

const configStore = useConfigStore()
const showApiKey = ref(false)

const save = async () => {
  try {
    await configStore.saveAll()
  } catch (err) {
    console.error('Failed to save Zotero config:', err)
  }
}
</script>

<style scoped>
.zotero-settings {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.zotero-settings h3 {
  margin-bottom: 12px;
  font-size: 16px;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-row label {
  width: 100px;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}

.form-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
  height: 36px;
  box-sizing: border-box;
}

.input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input {
  padding-right: 36px;
}

.toggle-visibility {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.toggle-visibility:hover {
  color: #6b7280;
}
</style>
