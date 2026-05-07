<template>
  <aside class="sidebar">
    <div class="actions-col">
      <button class="btn-fetch" :disabled="progressStore.isFetching" @click="doFetch('today')">
        <Download :size="13" />
        最新论文
      </button>
      <button class="btn-fetch" :disabled="progressStore.isFetching" @click="doFetch('week')">
        <Download :size="13" />
        本周论文
      </button>
      <button class="btn-fetch" :disabled="progressStore.isFetching" @click="openDateDialog">
        <Download :size="13" />
        指定日期
      </button>
      <button class="btn-fetch btn-analyze" :disabled="progressStore.isFetching" @click="analyzePapersAction">
        <PenLine :size="13" />
        总结论文
      </button>
    </div>

    <div class="section-title">日期列表</div>
    <div class="dates-section">
      <div
        class="nav-item"
        :class="{ active: !papersStore.selectedDate }"
        @click="selectDate(null)"
      >
        <span class="nav-label">全部论文</span>
        <span class="nav-count">{{ papersStore.totalCount }}</span>
      </div>
      <div
        v-for="fd in papersStore.fetchDates"
        :key="fd.date"
        class="nav-item"
        :class="{ active: papersStore.selectedDate === fd.date }"
        @click="selectDate(fd.date)"
      >
        <span class="nav-label">{{ fd.display }}</span>
        <span class="nav-count">{{ fd.count }}</span>
      </div>
    </div>

    <div class="sidebar-footer">
      <div class="footer-row">
        <button class="btn-icon" @click="goToConfig">
          <Settings :size="16" />
        </button>
        <button ref="queueBtnRef" class="btn-queue" @click="showQueuePanel = !showQueuePanel">
          <span class="queue-icon">
            <ListChecks :size="16" />
            <span v-if="queueTotalCount > 0" class="queue-badge">{{ queueTotalCount }}</span>
          </span>
        </button>
      </div>
      <Teleport to="body">
        <div v-if="showQueuePanel" class="sidebar-queue-panel">
          <div class="queue-panel-outer">
          <div class="queue-panel">
            <div class="queue-panel-header">
              <span class="queue-panel-title">总结队列</span>
              <button v-if="queueStore.isRunning || queueStore.queue.length > 0" class="btn-queue-stop" @click="queueStore.requestStop(); queueStore.clear()">全部取消</button>
            </div>
            <div class="queue-panel-list">
              <div v-if="!queueStore.currentPaperId && queueStore.queue.length === 0" class="queue-empty">
                <p>队列为空</p>
              </div>
              <div v-if="queueStore.currentPaperId" class="queue-item queue-item-active">
                <span class="queue-item-title">{{ currentPaperTitle }}</span>
                <span class="queue-item-status">分析中</span>
                <button class="queue-item-remove" @click="stopCurrentAnalysis" title="取消">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <div v-for="item in queueStore.queue" :key="item.id" class="queue-item">
                <span class="queue-item-title">{{ item.title }}</span>
                <button class="queue-item-remove" @click="removeItem(item.id)" title="取消">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="queue-section-divider"></div>
            <div class="queue-panel-header queue-panel-header-deep">
              <span class="queue-panel-title">分析队列</span>
              <button v-if="analysisQueueStore.isRunning || analysisQueueStore.queue.length > 0" class="btn-queue-stop" @click="analysisQueueStore.requestStop(); analysisQueueStore.clear()">全部取消</button>
            </div>
            <div class="queue-panel-list queue-panel-list-deep">
              <div v-if="!analysisQueueStore.currentPaperId && analysisQueueStore.queue.length === 0" class="queue-empty">
                <p>队列为空</p>
              </div>
              <div v-if="analysisQueueStore.currentPaperId" class="queue-item queue-item-active queue-item-active-deep">
                <span class="queue-item-title">{{ analysisQueueStore.currentPaperTitle }}</span>
                <span class="queue-item-status queue-item-status-deep">{{ analysisQueueStore.progressPhase }}</span>
                <button class="queue-item-remove" @click="stopCurrentPaperAnalysis" title="取消">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <div v-for="item in analysisQueueStore.queue" :key="item.id" class="queue-item">
                <span class="queue-item-title">{{ item.title }}</span>
                <span class="queue-item-status queue-item-status-deep">排队中</span>
                <button class="queue-item-remove" @click="removeAnalysisItem(item.id)" title="取消">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </Teleport>
    </div>
  </aside>

  <!-- Date range dialog -->
  <Teleport to="body">
    <div v-if="showDateDialog" class="sidebar-dialog">
      <div class="dialog-overlay" @click.self="showDateDialog = false">
        <div class="dialog-box">
          <h3 class="dialog-title">按日期抓取论文</h3>
          <div class="dialog-body">
            <div class="form-group">
              <label class="form-label">起始日期</label>
              <input v-model="dateForm.startDate" type="date" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">结束日期</label>
              <input v-model="dateForm.endDate" type="date" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">类别</label>
              <div class="category-checks">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    :checked="dateForm.selectedCategories.length === categories.length"
                    @change="toggleAllCategories"
                  />
                  全选
                </label>
                <div class="category-separator"></div>
                <label v-for="cat in categories" :key="cat.id" class="checkbox-label">
                  <input
                    v-model="dateForm.selectedCategories"
                    type="checkbox"
                    :value="cat.name"
                  />
                  {{ cat.name }}
                </label>
              </div>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-cancel" @click="showDateDialog = false">取消</button>
            <button class="btn-primary" :disabled="isDateFetching" @click="fetchByDateAction">
              {{ isDateFetching ? '获取中...' : '获取' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Download, PenLine, Settings, ListChecks } from 'lucide-vue-next'
import { fetchPapers, fetchPapersThisWeek, fetchPapersByDate, getUnanalyzedPaperIds, listCategories } from '../../api'
import type { Category } from '../../types/config'
import { usePapersStore } from '../../stores/papers'
import { useProgressStore } from '../../stores/progress'
import { useSummaryQueueStore } from '../../stores/analysisQueue'
import { useAnalysisQueueStore } from '../../stores/paperAnalysisQueue'
import { useToastStore } from '../../stores/toast'

const router = useRouter()
const papersStore = usePapersStore()
const progressStore = useProgressStore()
const queueStore = useSummaryQueueStore()
const analysisQueueStore = useAnalysisQueueStore()
const toastStore = useToastStore()

const showQueuePanel = ref(false)
const queueBtnRef = ref<HTMLElement | null>(null)

const queueTotalCount = computed(() => {
  return queueStore.queue.length + (queueStore.currentPaperId ? 1 : 0)
    + analysisQueueStore.queue.length + (analysisQueueStore.currentPaperId ? 1 : 0)
})

const currentPaperTitle = computed(() => queueStore.currentPaperTitle)

const removeItem = (id: string) => queueStore.remove(id)
const removeAnalysisItem = (id: string) => analysisQueueStore.remove(id)
const stopCurrentAnalysis = () => queueStore.cancelCurrent()
const stopCurrentPaperAnalysis = () => analysisQueueStore.cancelCurrent()

function onDocumentClick(e: MouseEvent) {
  if (!showQueuePanel.value) return
  const target = e.target as HTMLElement
  if (target.closest('.queue-panel') || target.closest('.btn-queue')) return
  showQueuePanel.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

const selectDate = (date: string | null) => {
  papersStore.selectDate(date)
}

const goToConfig = () => router.push('/config')

// ── Fetch logic ──────────────────────────────────────

async function doFetch(mode: 'today' | 'week') {
  if (progressStore.isFetching) return

  const label = mode === 'today' ? '最新' : '本周'
  progressStore.isFetching = true
  progressStore.progressPhase = `正在获取${label}论文...`
  progressStore.progressCurrent = 0
  progressStore.progressTotal = 0
  progressStore.currentPaper = ''

  try {
    const apiFn = mode === 'today' ? fetchPapers : fetchPapersThisWeek
    const result = await apiFn()

    if (result.success) {
      await Promise.all([
        papersStore.loadFetchDates(),
        papersStore.loadPapers(),
      ])

      const total = result.new_count + result.existing_count
      if (total > 0) {
        toastStore.show('获取完成', `获取${label}论文 ${total} 篇（新增 ${result.new_count} 篇）`, 'success')
      } else {
        toastStore.show('获取完成', `${label}无新论文`, 'info')
      }

      if (result.failed_categories.length > 0) {
        toastStore.show('部分失败', `${result.failed_categories.length} 个类别获取失败`, 'error')
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    toastStore.show('获取失败', `获取${label}论文失败: ${msg}`, 'error')
  } finally {
    progressStore.isFetching = false
    progressStore.progressPhase = ''
    progressStore.currentPaper = ''
  }
}

// ── Date dialog ──────────────────────────────────────

const showDateDialog = ref(false)
const isDateFetching = ref(false)
const categories = ref<Category[]>([])
const dateForm = reactive({
  startDate: defaultDateRange()[0],
  endDate: defaultDateRange()[1],
  selectedCategories: [] as string[],
})

function defaultDateRange(): [string, string] {
  const now = new Date()
  const end = formatDate(now)
  const start = new Date(now)
  start.setDate(start.getDate() - 7)
  return [formatDate(start), end]
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const openDateDialog = () => {
  showDateDialog.value = true
}

const toggleAllCategories = () => {
  if (dateForm.selectedCategories.length === categories.value.length) {
    dateForm.selectedCategories = []
  } else {
    dateForm.selectedCategories = categories.value.map(c => c.name)
  }
}

async function loadCategories() {
  try {
    categories.value = await listCategories()
    dateForm.selectedCategories = categories.value.map(c => c.name)
  } catch {
    // ignore
  }
}

onMounted(() => {
  loadCategories()
})

const fetchByDateAction = async () => {
  if (!dateForm.startDate || !dateForm.endDate) return
  if (dateForm.startDate > dateForm.endDate) return
  if (dateForm.selectedCategories.length === 0) {
    toastStore.show('提示', '请至少选择一个类别', 'info')
    return
  }

  isDateFetching.value = true
  progressStore.isFetching = true
  progressStore.progressPhase = '正在按日期获取论文...'
  progressStore.progressCurrent = 0
  progressStore.progressTotal = 0
  progressStore.currentPaper = ''

  try {
    const params = {
      startDate: dateForm.startDate,
      endDate: dateForm.endDate,
      categories: [...dateForm.selectedCategories],
    }
    const result = await fetchPapersByDate(params)

    if (!result.success) {
      toastStore.show('获取失败', `按日期获取失败: ${result.error || '未知错误'}`, 'error')
    } else {
      await Promise.all([
        papersStore.loadFetchDates(),
        papersStore.loadPapers(),
      ])

      let msg = `共 ${result.total_count} 篇论文`
      if (result.local_count > 0) msg += `（本地已有 ${result.local_count} 篇`
      if (result.new_count > 0) msg += `${result.local_count > 0 ? '，' : ''}新增 ${result.new_count} 篇`
      if (result.local_count > 0 || result.new_count > 0) msg += '）'

      toastStore.show('获取完成', msg, 'success')
      if (result.failed_categories.length > 0) {
        toastStore.show('部分失败', `${result.failed_categories.length} 个类别获取失败`, 'error')
      }
      showDateDialog.value = false
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    toastStore.show('获取失败', `按日期获取失败: ${msg}`, 'error')
  } finally {
    isDateFetching.value = false
    progressStore.isFetching = false
    progressStore.progressPhase = ''
    progressStore.currentPaper = ''
  }
}

const analyzePapersAction = async () => {
  try {
    const items = await getUnanalyzedPaperIds()
    const added = queueStore.enqueue(items)
    if (added === 0) {
      toastStore.show('提示', '所有未分析论文已在队列中', 'info')
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    toastStore.show('获取失败', `获取未分析论文失败: ${msg}`, 'error')
  }
}
</script>

<style scoped>
.sidebar {
  width: 100%;
  min-width: 180px;
  background: #f9fafb;
  border-right: none;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.actions-col {
  padding: 8px 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.btn-fetch {
  height: 30px;
  padding: 0 10px;
  background: transparent;
  color: #374151;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-fetch:hover:not(:disabled) {
  background: #e8e8e8;
}

.btn-fetch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-analyze {
  color: #059669;
}

.btn-analyze:hover:not(:disabled) {
  background: #e8e8e8;
}

.dates-section {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px;
  scrollbar-width: none;
}

.dates-section::-webkit-scrollbar {
  display: none;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
  user-select: none;
}

.nav-item:hover {
  background: #f0f0f0;
}

.nav-item.active {
  background: #dbeafe;
}

.nav-label {
  flex: 1;
  font-size: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  padding: 0 12px;
  margin-top: 14px;
  margin-bottom: 8px;
}

.nav-count {
  font-size: 12px;
  color: #6b7280;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 10px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid #e8e8e8;
}

.footer-row {
  display: flex;
  gap: 6px;
}

.btn-queue {
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: #6b7280;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-queue:hover {
  background: #e8e8e8;
  color: #374151;
}

.queue-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.queue-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  background: #059669;
  color: #fff;
  font-size: 9px;
  font-weight: 600;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: #6b7280;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #e8e8e8;
  color: #374151;
}
</style>

<!-- Non-scoped styles for teleported elements -->
<style>
.sidebar-queue-panel .queue-panel-outer {
  position: fixed;
  bottom: 12px;
  left: 252px;
  width: 360px;
  z-index: 301;
  filter: drop-shadow(0 8px 30px rgba(0, 0, 0, 0.15));
  animation: sidebar-fadeIn 0.15s ease;
}

.sidebar-queue-panel .queue-panel {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
}

@keyframes sidebar-fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.sidebar-queue-panel .queue-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #e8e8e8;
}

.sidebar-queue-panel .queue-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.sidebar-queue-panel .queue-panel-header-deep {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #e8e8e8;
}

.sidebar-queue-panel .btn-queue-stop {
  padding: 2px 8px;
  background: #fff;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.sidebar-queue-panel .btn-queue-stop:hover {
  background: #fee2e2;
}

.sidebar-queue-panel .queue-panel-list {
  height: 220px;
  overflow: hidden auto;
  overscroll-behavior: none;
  padding: 0;
  scrollbar-width: none;
}

.sidebar-queue-panel .queue-panel-list::-webkit-scrollbar {
  display: none;
}

.sidebar-queue-panel .queue-panel-list-deep {
  height: 220px;
  overflow: hidden auto;
  overscroll-behavior: none;
  padding: 0;
  scrollbar-width: none;
}

.sidebar-queue-panel .queue-panel-list-deep::-webkit-scrollbar {
  display: none;
}

.sidebar-queue-panel .queue-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  font-size: 13px;
}

.sidebar-queue-panel .queue-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  overflow: hidden;
}

.sidebar-queue-panel .queue-item:hover .queue-item-remove {
  opacity: 1;
}

.sidebar-queue-panel .queue-item-active {
  background: #f0fdf4;
}

.sidebar-queue-panel .queue-item-status {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: #059669;
  background: #d1fae5;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.sidebar-queue-panel .queue-item-title {
  flex: 1;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.sidebar-queue-panel .queue-item-remove {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #fff;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}

.sidebar-queue-panel .queue-item-remove::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%);
  pointer-events: none;
  z-index: -1;
}

.sidebar-queue-panel .queue-item-remove:hover {
  color: #dc2626;
  background: #fee2e2;
}

.sidebar-queue-panel .queue-section-divider {
  height: 1px;
  background: #e8e8e8;
  margin: 0;
}

.sidebar-queue-panel .queue-item-active-deep {
  background: #f5f3ff;
}

.sidebar-queue-panel .queue-item-status-deep {
  color: #7c3aed;
  background: #e9d5ff;
}

.sidebar-dialog .dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.sidebar-dialog .dialog-box {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  width: 440px;
  max-width: 90vw;
}

.sidebar-dialog .dialog-title {
  font-size: 16px;
  font-weight: 600;
  padding: 20px 24px 0;
}

.sidebar-dialog .dialog-body {
  padding: 20px 24px;
}

.sidebar-dialog .form-group {
  margin-bottom: 16px;
}

.sidebar-dialog .form-group:last-child {
  margin-bottom: 0;
}

.sidebar-dialog .form-label {
  display: block;
  font-size: 13px;
  color: #374151;
  margin-bottom: 6px;
}

.sidebar-dialog .form-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #1a1a1a;
  box-sizing: border-box;
}

.sidebar-dialog .form-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.sidebar-dialog .category-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 120px;
  overflow-y: auto;
  padding: 4px 0;
}

.sidebar-dialog .checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}

.sidebar-dialog .category-separator {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 0;
}

.sidebar-dialog .checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
}

.sidebar-dialog .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid #e8e8e8;
}

.sidebar-dialog .btn-cancel {
  height: 36px;
  padding: 0 20px;
  background: #fff;
  color: #6b7280;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.sidebar-dialog .btn-cancel:hover {
  background: #f9fafb;
  color: #374151;
}

.sidebar-dialog .btn-primary {
  height: 36px;
  padding: 0 20px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.sidebar-dialog .btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.sidebar-dialog .btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
