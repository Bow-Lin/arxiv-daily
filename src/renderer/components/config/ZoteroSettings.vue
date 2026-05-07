<template>
  <div class="zotero-settings">
    <h3>Zotero</h3>

    <div class="form-row">
      <label>API Key</label>
      <input v-model="configStore.zoteroConfig.api_key" placeholder="Zotero API Key" @change="save" />
    </div>

    <div class="form-row">
      <label>User ID</label>
      <input v-model="configStore.zoteroConfig.user_id" placeholder="数字 ID" @change="save" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConfigStore } from '../../stores/config'

const configStore = useConfigStore()

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
  margin-bottom: 16px;
  font-size: 16px;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
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
</style>
