<template>
  <div class="llm-settings">
    <h3>LLM 设置</h3>

    <div class="form-row">
      <label>API Key</label>
      <div class="input-wrapper">
        <input v-model="configStore.llmConfig.api_key" :type="showApiKey ? 'text' : 'password'" placeholder="sk-..." @change="save" class="input-icon-right" />
        <svg class="eye-icon" @click="showApiKey = !showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <template v-if="showApiKey">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </template>
          <template v-else>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </template>
        </svg>
      </div>
    </div>

    <div class="form-row">
      <label>Base URL</label>
      <input v-model="configStore.llmConfig.base_url" placeholder="https://api.openai.com/v1" @change="save" />
    </div>

    <div class="form-row">
      <label>Model</label>
      <input v-model="configStore.llmConfig.model" placeholder="gpt-4o" @change="save" />
    </div>

    <div class="form-row">
      <label>Temperature</label>
      <input v-model.number="configStore.llmConfig.temperature" type="number" min="0" max="2" step="0.1" @change="save" />
    </div>

    <div class="test-row">
      <button class="btn-test" @click="testConnection" :disabled="testing">
        {{ testing ? '测试中...' : '测试连接' }}
      </button>
      <span v-if="testResult" :class="testResult.success ? 'test-success' : 'test-error'">
        {{ testResult.message }}
      </span>
    </div>
  </div>

  <div class="proxy-settings">
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
import { ref } from 'vue'
import { useConfigStore } from '../../stores/config'
import { testLLMConnection } from '../../api'

const configStore = useConfigStore()
const showApiKey = ref(false)
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const save = async () => {
  try {
    await configStore.saveAll()
  } catch (err) {
    console.error('Failed to save LLM config:', err)
  }
}

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    await configStore.saveAll()
    const result = await testLLMConnection()
    testResult.value = { success: result.success, message: result.message || '连接成功' }
  } catch (err: unknown) {
    console.error('LLM test error:', err)
    let msg = '连接失败'
    if (typeof err === 'string') {
      msg = err
    } else if (err instanceof Error) {
      msg = err.message
    } else if (typeof err === 'object' && err !== null) {
      const obj = err as Record<string, unknown>
      msg = String(obj.LLM || obj.Database || obj.Config || obj.message || msg)
    } else {
      msg = String(err)
    }
    testResult.value = { success: false, message: msg }
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.llm-settings {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.llm-settings h3 {
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

.input-wrapper {
  position: relative;
  flex: 1;
}

.input-icon-right {
  padding-right: 36px;
}

.eye-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  width: 16px;
  height: 16px;
  color: #9ca3af;
  user-select: none;
  transition: color 0.15s;
}

.eye-icon:hover {
  color: #6b7280;
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

.input-wrapper input {
  width: 100%;
}

.test-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-left: 112px;
}

.btn-test {
  padding: 8px 20px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-test:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-test:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-success {
  color: #059669;
  font-size: 13px;
}

.test-error {
  color: #dc2626;
  font-size: 13px;
}

.proxy-settings {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.proxy-settings h3 {
  margin-bottom: 16px;
  font-size: 16px;
}
</style>
