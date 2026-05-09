<template>
  <div class="llm-settings">
    <h3>LLM 设置</h3>

    <div class="form-row">
      <label>API Key</label>
      <div class="input-wrapper">
        <input v-model="configStore.llmConfig.api_key" :type="showApiKey ? 'text' : 'password'" placeholder="sk-..." class="input-icon-right" />
        <button class="toggle-visibility" @click="showApiKey = !showApiKey">
          <Eye v-if="!showApiKey" :size="16" />
          <EyeOff v-else :size="16" />
        </button>
      </div>
    </div>

    <div class="form-row">
      <label>Base URL</label>
      <input v-model="configStore.llmConfig.base_url" placeholder="https://api.openai.com/v1" />
    </div>

    <div class="form-row">
      <label>Model</label>
      <input v-model="configStore.llmConfig.model" placeholder="gpt-4o" />
    </div>

    <div class="form-row">
      <label>Temperature</label>
      <input v-model.number="configStore.llmConfig.temperature" type="number" min="0" max="2" step="0.1" />
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { useConfigStore } from '../../stores/config'
import { testLLMConnection } from '../../api'

const configStore = useConfigStore()
const showApiKey = ref(false)
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
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
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.llm-settings h3 {
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

.input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.input-icon-right {
  padding-right: 38px;
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
  color: var(--text-placeholder);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.toggle-visibility:hover {
  color: var(--text-tertiary);
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

.input-wrapper input {
  flex: 1;
  min-width: 0;
}

.test-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.btn-test {
  padding: 8px 20px;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-test:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.btn-test:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-success {
  color: var(--color-success);
  font-size: 13px;
}

.test-error {
  color: var(--color-error);
  font-size: 13px;
}
</style>
