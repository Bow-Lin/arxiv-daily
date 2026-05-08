<template>
  <div class="network-settings">
    <h3>网络设置</h3>

    <div class="form-row">
      <label>HTTP 代理</label>
      <input v-model="configStore.proxyConfig.http" placeholder="http://127.0.0.1:7890" @change="save" />
    </div>

    <div class="form-row">
      <label>HTTPS 代理</label>
      <input v-model="configStore.proxyConfig.https" placeholder="http://127.0.0.1:7890" @change="save" />
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
    console.error('Failed to save network config:', err)
  }
}
</script>

<style scoped>
.network-settings {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.network-settings h3 {
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
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: 14px;
  height: 36px;
  box-sizing: border-box;
}
</style>
