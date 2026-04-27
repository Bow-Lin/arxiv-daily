<template>
  <div class="config-view">
    <header class="config-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h1>设置</h1>
    </header>

    <div class="config-content">
      <CategoryEditor />
      <TopicEditor />
      <LLMSettings />

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

    <div v-if="showSuccess" class="success-toast">
      ✅ {{ successMsg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import TopicEditor from '../components/config/TopicEditor.vue'
import CategoryEditor from '../components/config/CategoryEditor.vue'
import LLMSettings from '../components/config/LLMSettings.vue'
import { useConfigStore } from '../stores/config'
import { usePapersStore } from '../stores/papers'
import { clearData, clearAnalyses } from '../api'

const router = useRouter()
const configStore = useConfigStore()
const papersStore = usePapersStore()
const showSuccess = ref(false)
const successMsg = ref('设置已保存')
const confirmClearData = ref(false)
const confirmClearAnalyses = ref(false)
let successTimer: number | null = null
let confirmDataTimer: number | null = null
let confirmAnalysesTimer: number | null = null

const clearAllTimers = () => {
  if (successTimer) { clearTimeout(successTimer); successTimer = null }
  if (confirmDataTimer) { clearTimeout(confirmDataTimer); confirmDataTimer = null }
  if (confirmAnalysesTimer) { clearTimeout(confirmAnalysesTimer); confirmAnalysesTimer = null }
}

onUnmounted(() => {
  clearAllTimers()
})

const showSuccessToast = (msg: string) => {
  if (successTimer) clearTimeout(successTimer)
  successMsg.value = msg
  showSuccess.value = true
  successTimer = window.setTimeout(() => { showSuccess.value = false }, 2000)
}

const goBack = () => router.push('/')

const saveAll = async () => {
  try {
    await configStore.saveAll()
    showSuccessToast('设置已保存')
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
    papersStore.papers = []
    papersStore.loadPapers()
    papersStore.loadFetchDates()
    showSuccessToast('数据已清空')
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
    papersStore.papers = []
    papersStore.loadPapers()
    showSuccessToast('分析数据已清空')
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
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  padding: 0 24px 0 80px; /* 左侧留出 macOS 交通灯空间 */
  -webkit-app-region: drag;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.back-btn {
  width: 36px;
  height: 36px;
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
  font-size: 18px;
  font-weight: 600;
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

.success-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #10b981;
  color: white;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 200;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
