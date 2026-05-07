<template>
  <div class="config-view">
    <header class="config-header" :class="{ 'no-titlebar-indent': !isMac }">
      <button class="back-btn" @click="goBack">
        <ChevronLeft :size="20" />
      </button>
      <h1>设置</h1>
    </header>

    <div class="config-content">
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
const isMac = navigator.userAgentData.platform === 'macOS'
const configStore = useConfigStore()
const papersStore = usePapersStore()
const toastStore = useToastStore()
const confirmClearData = ref(false)
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
  background: #ffffff;
}

.config-header {
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
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
  color: #6b7280;
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
  background: #f0f0f0;
}

.config-header h1 {
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
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
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.danger-zone {
  margin-top: 48px;
  padding: 20px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
}

.danger-title {
  font-size: 15px;
  font-weight: 600;
  color: #dc2626;
  margin-bottom: 8px;
}

.danger-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
}

.btn-danger {
  padding: 10px 24px;
  background: #fff;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-danger:hover {
  background: #fee2e2;
}

.btn-danger.confirming {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.danger-divider {
  height: 1px;
  background: #fecaca;
  margin: 16px 0;
}

</style>
