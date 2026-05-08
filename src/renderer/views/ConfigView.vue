<template>
  <div class="config-view">
    <header class="config-header" :class="{ 'no-titlebar-indent': !isMac }">
      <button class="back-btn" @click="goBack">
        <ChevronLeft :size="20" />
      </button>
      <h1>设置</h1>
    </header>

    <div class="config-content">
      <div class="config-section theme-section">
        <h3 class="section-title">外观设置</h3>
        <div class="theme-options">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            class="theme-btn"
            :class="{ active: pendingTheme === option.value }"
            @click="pendingTheme = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <CategoryEditor />
      <TopicEditor />
      <LLMSettings />
      <ZoteroSettings />
      <NetworkSettings />

      <div class="config-actions">
        <button class="btn-primary" @click="saveAll">保存设置</button>
      </div>

      <div class="danger-zone">
        <h3 class="danger-title">危险操作</h3>
        <p class="danger-desc">清空所有分析数据，论文和阅读记录不受影响。</p>
        <button
          class="btn-danger"
          :class="{ confirming: confirmClearAnalyses }"
          @click="handleClearAnalyses"
        >
          {{ confirmClearAnalyses ? '再次点击确认' : '清空分析数据' }}
        </button>
        <div class="danger-divider"></div>
        <p class="danger-desc">清空所有论文数据，包括论文、分析结果和阅读记录。主题和设置不会被删除。</p>
        <button
          class="btn-danger"
          :class="{ confirming: confirmClearData }"
          @click="handleClearData"
        >
          {{ confirmClearData ? '再次点击确认' : '清空所有数据' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'
import TopicEditor from '../components/config/TopicEditor.vue'
import CategoryEditor from '../components/config/CategoryEditor.vue'
import LLMSettings from '../components/config/LLMSettings.vue'
import NetworkSettings from '../components/config/NetworkSettings.vue'
import ZoteroSettings from '../components/config/ZoteroSettings.vue'
import { useConfigStore } from '../stores/config'
import { usePapersStore } from '../stores/papers'
import { useToastStore } from '../stores/toast'
import { clearData, clearAnalyses } from '../api'

const router = useRouter()
const isMac = (navigator as any).userAgentData?.platform === 'macOS'
const configStore = useConfigStore()
const papersStore = usePapersStore()
const toastStore = useToastStore()
const confirmClearData = ref(false)
const themeOptions = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]
const pendingTheme = ref(configStore.theme)
const confirmClearAnalyses = ref(false)
let confirmDataTimer: number | null = null
let confirmAnalysesTimer: number | null = null

const clearAllTimers = () => {
  if (confirmDataTimer) { clearTimeout(confirmDataTimer); confirmDataTimer = null }
  if (confirmAnalysesTimer) { clearTimeout(confirmAnalysesTimer); confirmAnalysesTimer = null }
}

onUnmounted(() => {
  clearAllTimers()
})

const goBack = () => router.push('/')

const saveAll = async () => {
  try {
    configStore.theme = pendingTheme.value
    await configStore.saveAll()
    toastStore.show('保存成功', '设置已保存', 'success')
  } catch (err) {
    console.error('Failed to save config:', err)
    alert('保存失败: ' + (err instanceof Error ? err.message : String(err)))
  }
}

const handleClearData = async () => {
  if (!confirmClearData.value) {
    confirmClearData.value = true
    confirmDataTimer = window.setTimeout(() => { confirmClearData.value = false }, 3000)
    return
  }
  clearAllTimers()
  confirmClearData.value = false
  try {
    await clearData()
    papersStore.clearPapers()
    papersStore.loadPapers()
    papersStore.loadFetchDates()
    toastStore.show('已清空', '数据已清空', 'success')
  } catch (err) {
    alert('清空数据失败: ' + (err instanceof Error ? err.message : err))
  }
}

const handleClearAnalyses = async () => {
  if (!confirmClearAnalyses.value) {
    confirmClearAnalyses.value = true
    confirmAnalysesTimer = window.setTimeout(() => { confirmClearAnalyses.value = false }, 3000)
    return
  }
  clearAllTimers()
  confirmClearAnalyses.value = false
  try {
    await clearAnalyses()
    papersStore.clearPapers()
    papersStore.loadPapers()
    papersStore.loadFetchDates()
    toastStore.show('已清空', '分析数据已清空', 'success')
  } catch (err) {
    alert('清空分析数据失败: ' + (err instanceof Error ? err.message : err))
  }
}
</script>

<style scoped>
.config-view {
  height: 100vh;
  overflow-y: auto;
  background: var(--card-bg);
}

.config-header {
  height: 48px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  align-items: center;
  padding: 0 24px 0 80px;
  -webkit-app-region: drag;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.config-header.no-titlebar-indent {
  padding-left: 24px;
}

.back-btn {
  width: 32px;
  height: 32px;
  color: var(--text-tertiary);
  -webkit-app-region: no-drag;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  background: var(--card-border);
}

.config-header h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.config-content {
  max-width: 700px;
  margin: 0 auto;
  padding: 24px;
}

.config-actions {
  margin-top: 24px;
  text-align: center;
}

.btn-primary {
  padding: 12px 32px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.danger-zone {
  margin-top: 48px;
  padding: 20px;
  border: 1px solid var(--color-error-border);
  border-radius: 8px;
  background: var(--color-error-bg);
}

.danger-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-error);
  margin-bottom: 8px;
}

.danger-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.btn-danger {
  padding: 10px 24px;
  background: var(--card-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error-border);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-danger:hover {
  background: var(--color-error-bg);
}

.btn-danger.confirming {
  background: var(--color-error);
  color: white;
  border-color: var(--color-error);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.danger-divider {
  height: 1px;
  background: var(--color-error-border);
  margin: 16px 0;
}

.theme-section {
  margin-bottom: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.theme-options {
  display: flex;
  gap: 8px;
}

.theme-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.theme-btn:hover {
  border-color: var(--border-secondary);
}

.theme-btn.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

</style>
