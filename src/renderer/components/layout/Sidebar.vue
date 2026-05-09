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
      <button class="btn-fetch" :disabled="progressStore.isFetching" @click="analyzePapersAction">
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
          <Settings :size="14" />
        </button>
        <button ref="queueBtnRef" class="btn-queue" @click="toggleQueuePanel">
          <span class="queue-icon">
            <ListChecks :size="14" />
            <span v-if="queueTotalCount > 0" class="queue-badge">{{ queueTotalCount }}</span>
          </span>
        </button>
      </div>
      <Teleport to="body">
        <div v-if="showQueuePanel" class="sidebar-queue-panel">
          <div class="queue-panel-outer">
          <div class="queue-panel">
            <div class="queue-panel-header" @click="summaryCollapsed = !summaryCollapsed">
              <span class="queue-panel-title">总结队列</span>
              <div class="queue-header-actions">
                <button v-if="queueStore.isRunning || queueStore.queue.length > 0" class="btn-queue-stop" @click.stop="queueStore.requestStop(); queueStore.clear()">全部取消</button>
                <svg class="collapse-arrow" :class="{ collapsed: summaryCollapsed }" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <Transition name="collapse">
            <div v-show="!summaryCollapsed" class="queue-panel-list">
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
            </Transition>
            <div class="queue-section-divider"></div>
            <div class="queue-panel-header" @click="analysisCollapsed = !analysisCollapsed">
              <span class="queue-panel-title">分析队列</span>
              <div class="queue-header-actions">
                <button v-if="analysisQueueStore.isRunning || analysisQueueStore.queue.length > 0" class="btn-queue-stop" @click.stop="analysisQueueStore.requestStop(); analysisQueueStore.clear()">全部取消</button>
                <svg class="collapse-arrow" :class="{ collapsed: analysisCollapsed }" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <Transition name="collapse">
            <div v-show="!analysisCollapsed" class="queue-panel-list">
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
            </Transition>
            <div class="queue-section-divider"></div>
            <div class="queue-panel-header" @click="downloadCollapsed = !downloadCollapsed">
              <span class="queue-panel-title">下载队列</span>
              <div class="queue-header-actions">
                <button v-if="downloadStore.isRunning || downloadStore.queue.length > 0" class="btn-queue-stop" @click.stop="downloadStore.clear()">全部取消</button>
                <svg class="collapse-arrow" :class="{ collapsed: downloadCollapsed }" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <Transition name="collapse">
            <div v-show="!downloadCollapsed" class="queue-panel-list">
              <div v-if="!downloadStore.currentPaperId && downloadStore.queue.length === 0" class="queue-empty">
                <p>队列为空</p>
              </div>
              <div v-if="downloadStore.currentPaperId" class="queue-item queue-item-active">
                <span class="queue-item-title">{{ downloadStore.currentPaperTitle || '下载中' }}</span>
                <span class="queue-item-status">{{ downloadStore.currentProgress }}%</span>
                <button class="queue-item-remove" @click="downloadStore.remove(downloadStore.currentPaperId!)" title="取消">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <div v-for="item in downloadStore.queue" :key="item.id" class="queue-item">
                <span class="queue-item-title">{{ item.title }}</span>
                <span class="queue-item-status">排队中</span>
                <button class="queue-item-remove" @click="downloadStore.remove(item.id)" title="取消">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
            </Transition>
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
import { useSummaryQueueStore } from '../../stores/summaryQueue'
import { useAnalysisQueueStore } from '../../stores/analysisQueue'
import { useDownloadQueueStore } from '../../stores/downloadQueue'
import { useToastStore } from '../../stores/toast'
import { extractErrorMessage } from '../../utils/format'

const router = useRouter()
const papersStore = usePapersStore()
const progressStore = useProgressStore()
const queueStore = useSummaryQueueStore()
const analysisQueueStore = useAnalysisQueueStore()
const downloadStore = useDownloadQueueStore()
const toastStore = useToastStore()
let fetchingToastId = -1

const showQueuePanel = ref(false)
const queueBtnRef = ref<HTMLElement | null>(null)
const summaryCollapsed = ref(true)
const analysisCollapsed = ref(true)
const downloadCollapsed = ref(true)

const toggleQueuePanel = () => {
  showQueuePanel.value = !showQueuePanel.value
  if (showQueuePanel.value) {
    summaryCollapsed.value = !queueStore.currentPaperId && queueStore.queue.length === 0
    analysisCollapsed.value = !analysisQueueStore.currentPaperId && analysisQueueStore.queue.length === 0
    downloadCollapsed.value = !downloadStore.currentPaperId && downloadStore.queue.length === 0
  }
}

const queueTotalCount = computed(() => {
  return queueStore.queue.length + (queueStore.currentPaperId ? 1 : 0)
    + analysisQueueStore.queue.length + (analysisQueueStore.currentPaperId ? 1 : 0)
    + downloadStore.queue.length + (downloadStore.currentPaperId ? 1 : 0)
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

function showFetchResult(newCount: number, existingCount: number, failedCategories: string[], failedDetails: { category: string; error: string }[], label?: string) {
  const hasFailures = failedCategories.length > 0
  const totalCount = newCount + existingCount

  if (newCount > 0) {
    const details = `成功抓取 ${totalCount} 篇，本地已有 ${existingCount} 篇`
    toastStore.show('获取完成', `新增 ${newCount} 篇论文`, 'success', details)
  } else if (totalCount > 0) {
    toastStore.show('获取完成', '无新论文', 'info', `已抓取 ${totalCount} 篇，均为本地已有`)
  } else if (!hasFailures) {
    toastStore.show('获取完成', label ? `${label}无新论文` : '未找到相关论文', 'info')
  }

  if (hasFailures) {
    const summary = totalCount > 0
      ? `${failedCategories.length} 个类别获取失败`
      : '全部类别获取失败'
    const details = failedDetails
      .map(d => `[${d.category}] ${d.error}`)
      .join('\n')
    toastStore.show('获取异常', summary, 'error', details)
  }
}

async function doFetch(mode: 'today' | 'week') {
  if (progressStore.isFetching) return

  const label = mode === 'today' ? '最新' : '本周'
  progressStore.isFetching = true
  progressStore.progressPhase = `正在获取${label}论文...`
  progressStore.progressCurrent = 0
  progressStore.progressTotal = 0
  progressStore.currentPaper = ''

  toastStore.resetToastId()
  fetchingToastId = toastStore.show('抓取中', `正在获取${label}论文...`, 'info', undefined, 0)

  try {
    const apiFn = mode === 'today' ? fetchPapers : fetchPapersThisWeek
    const result = await apiFn()

    if (result.success) {
      await Promise.all([
        papersStore.loadFetchDates(),
        papersStore.loadPapers(),
      ])
      showFetchResult(result.new_count, result.existing_count, result.failed_categories, result.failed_details, label)
    }
  } catch (err: unknown) {
    const msg = extractErrorMessage(err)
    toastStore.show('获取失败', `获取${label}论文失败`, 'error', msg)
  } finally {
    if (fetchingToastId >= 0) { toastStore.remove(fetchingToastId); fetchingToastId = -1 }
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

  toastStore.resetToastId()
  fetchingToastId = toastStore.show('抓取中', '正在按日期获取论文...', 'info', undefined, 0)

  showDateDialog.value = false

  try {
    const params = {
      startDate: dateForm.startDate,
      endDate: dateForm.endDate,
      categories: [...dateForm.selectedCategories],
    }
    const result = await fetchPapersByDate(params)

    await Promise.all([
      papersStore.loadFetchDates(),
      papersStore.loadPapers(),
    ])
    showFetchResult(result.new_count, result.local_count, result.failed_categories, result.failed_details)
  } catch (err: unknown) {
    const msg = extractErrorMessage(err)
    toastStore.show('获取失败', '按日期获取失败', 'error', msg)
  } finally {
    if (fetchingToastId >= 0) { toastStore.remove(fetchingToastId); fetchingToastId = -1 }
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
    const msg = extractErrorMessage(err)
    toastStore.show('获取失败', '获取未分析论文失败', 'error', msg)
  }
}
</script>

<style scoped>
.sidebar {
  width: 100%;
  min-width: 180px;
  background: var(--sidebar-bg);
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
  color: var(--text-secondary);
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
  background: var(--border-primary);
}

.btn-fetch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  background: var(--card-border);
}

.nav-item.active {
  background: var(--nav-active);
}

.nav-label {
  flex: 1;
  font-size: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-placeholder);
  text-transform: uppercase;
  padding: 0 12px;
  margin-top: 14px;
  margin-bottom: 8px;
}

.nav-count {
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
}

.sidebar-footer {
  padding: 6px 12px;
  border-top: 1px solid var(--border-primary);
}

.footer-row {
  display: flex;
  gap: 6px;
  justify-content: space-between;
}

.btn-queue {
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: var(--text-tertiary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-queue:hover {
  background: var(--border-primary);
  color: var(--text-secondary);
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
  background: var(--badge-success);
  color: var(--card-bg);
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
  color: var(--text-tertiary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--border-primary);
  color: var(--text-secondary);
}
</style>

<!-- Non-scoped styles for teleported elements -->
<style>
.sidebar-queue-panel .queue-panel-outer {
  position: fixed;
  bottom: 6px;
  left: 252px;
  width: 360px;
  z-index: 301;
  filter: drop-shadow(0 8px 30px var(--shadow-lg));
  animation: sidebar-fadeIn 0.15s ease;
}

.sidebar-queue-panel .queue-panel {
  background: var(--panel-bg);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  overflow: hidden;
}

@keyframes sidebar-fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.sidebar-queue-panel .queue-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-primary);
  background: var(--panel-header-bg);
  cursor: pointer;
  user-select: none;
}

.sidebar-queue-panel .queue-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-queue-panel .queue-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-queue-panel .collapse-arrow {
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.sidebar-queue-panel .collapse-arrow.collapsed {
  transform: rotate(-90deg);
}

.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 220px;
}

.sidebar-queue-panel .btn-queue-stop {
  padding: 2px 8px;
  background: var(--card-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error-border);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.sidebar-queue-panel .btn-queue-stop:hover {
  background: var(--color-error-bg);
}

.sidebar-queue-panel .queue-panel-list {
  height: 160px;
  overflow: hidden auto;
  overscroll-behavior: none;
  padding: 0;
  scrollbar-width: none;
  background: var(--panel-list-bg);
}

.sidebar-queue-panel .queue-panel-list::-webkit-scrollbar {
  display: none;
}

.sidebar-queue-panel .queue-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-placeholder);
  font-size: 13px;
}

.sidebar-queue-panel .queue-item {
  display: grid;
  grid-template-columns: 1fr;
  padding: 8px 16px;
  overflow: hidden;
  align-items: center;
}

.sidebar-queue-panel .queue-item:hover .queue-item-remove {
  opacity: 1;
}

.sidebar-queue-panel .queue-item-active {
  background: var(--color-success-bg);
}

.sidebar-queue-panel .queue-item-status {
  grid-column: 1;
  grid-row: 1;
  justify-self: end;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-success);
  background: var(--color-success-bg);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.sidebar-queue-panel .queue-item-title {
  grid-column: 1;
  grid-row: 1;
  padding-right: 24px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.sidebar-queue-panel .queue-item-remove {
  grid-column: 1;
  grid-row: 1;
  justify-self: end;
  align-self: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--card-bg);
  color: var(--text-placeholder);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  visibility: hidden;
}

.sidebar-queue-panel .queue-item:hover .queue-item-remove {
  visibility: visible;
}

.sidebar-queue-panel .queue-item-remove:hover {
  color: var(--color-error);
  background: var(--color-error-bg);
}

.sidebar-queue-panel .queue-section-divider {
  height: 1px;
  background: var(--border-primary);
  margin: 0;
}

.sidebar-queue-panel .queue-item-active-deep {
  background: var(--color-deep-bg);
}

.sidebar-queue-panel .queue-item-status-deep {
  color: var(--color-deep);
  background: var(--color-deep-border);
}

.sidebar-dialog .dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.sidebar-dialog .dialog-box {
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 20px 60px var(--shadow-lg);
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
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.sidebar-dialog .form-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-secondary);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  box-sizing: border-box;
}

.sidebar-dialog .form-input:focus {
  outline: none;
  border-color: var(--color-primary);
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
  color: var(--text-secondary);
  cursor: pointer;
}

.sidebar-dialog .category-separator {
  height: 1px;
  background: var(--bg-tertiary);
  margin: 4px 0;
}

.sidebar-dialog .checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.sidebar-dialog .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-primary);
}

.sidebar-dialog .btn-cancel {
  height: 36px;
  padding: 0 20px;
  background: var(--card-bg);
  color: var(--text-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.sidebar-dialog .btn-cancel:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.sidebar-dialog .btn-primary {
  height: 36px;
  padding: 0 20px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.sidebar-dialog .btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.sidebar-dialog .btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
