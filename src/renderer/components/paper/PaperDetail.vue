<template>
  <div class="detail-panel">
    <div v-if="paper" class="detail-content">
      <h2 class="detail-title">{{ paper.title }}</h2>

      <div class="detail-meta">
        <p><strong>作者:</strong> {{ paper.authors.join(', ') }}</p>
        <p><strong>分类:</strong> {{ paper.categories.join(', ') }}</p>
        <p><strong>更新时间:</strong> {{ formatDateFull(paper.updated_date) }}</p>
        <p><strong>arXiv ID:</strong> {{ paper.id }}</p>
      </div>

      <div class="detail-actions">
        <a :href="paper.url" target="_blank" rel="noopener noreferrer" class="action-link action-pdf">打开 arXiv</a>
        <button class="action-link action-pdf" :disabled="isDownloadingPdf" @click="downloadPdf">
          {{ isDownloadingPdf ? `下载中 ${downloadProgress}%` : isPdfCached ? '打开 PDF' : '下载 PDF' }}
        </button>
        <button class="action-link action-analyze" :disabled="isInQueue" @click="addToQueue">
          {{ isCurrentPaper ? '总结中...' : isInQueue ? '排队中...' : '论文总结' }}
        </button>
        <button class="action-link action-deep" :disabled="isAnalysisInQueue" @click="addToAnalysisQueue">
          {{ isAnalysisCurrentPaper ? '分析中...' : isAnalysisInQueue ? '排队中...' : '论文分析' }}
        </button>
        <div class="zotero-export-wrapper">
          <button class="action-link action-zotero" :disabled="exportingToZotero" @click="toggleMenu('zotero'); loadCollectionsIfNeeded()">
            {{ exportingToZotero ? '导出中...' : '导出到 Zotero' }}
          </button>
          <div v-if="showZoteroMenu" class="zotero-menu">
            <div v-if="loadingCollections" class="zotero-menu-loading">加载中...</div>
            <div v-else-if="zoteroError" class="zotero-menu-empty">{{ zoteroError }}</div>
            <div v-else-if="collections.length === 0" class="zotero-menu-empty">暂无集合</div>
            <div v-else>
              <div v-for="c in collections" :key="c.key" class="zotero-menu-item" @click="doExportToZotero(c.key)">
                {{ c.name }}
              </div>
            </div>
          </div>
        </div>
        <div class="more-wrapper">
          <button class="action-link action-more" @click="toggleMenu('more')">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
            </svg>
          </button>
          <div v-if="showMoreMenu" class="zotero-menu">
            <div class="zotero-menu-item" :class="{ disabled: !isPdfCached }" @click="doDeletePdf">
              删除 PDF
            </div>
            <div class="zotero-menu-item" :class="{ disabled: !hasSummary }" @click="doDeleteSummary">
              删除论文总结
            </div>
            <div class="zotero-menu-item" :class="{ disabled: !hasAnalysis }" @click="doDeleteAnalysis">
              删除论文分析
            </div>
          </div>
        </div>
      </div>

      <!-- Tab navigation -->
      <div class="detail-tabs">
        <button class="tab-item" :class="{ active: activeTab === 'abstract' }" @click="activeTab = 'abstract'">论文摘要</button>
        <button class="tab-item" :class="{ active: activeTab === 'summary' }" @click="activeTab = 'summary'">论文总结</button>
        <button class="tab-item" :class="{ active: activeTab === 'analysis' }" @click="activeTab = 'analysis'">论文分析</button>
      </div>

      <!-- Tab content -->
      <div class="detail-section">
        <div v-show="activeTab === 'abstract'" class="section-body">
          <div class="tex-content" v-html="renderLatex(paper.abstract_text)"></div>
        </div>
        <div v-show="activeTab === 'summary'" class="section-body">
          <div v-if="!isAnalyzed" class="empty-hint">暂无论文总结，请先执行论文总结</div>
          <div v-else class="tex-content" v-html="renderMarkdown(paper.summary || '')"></div>
        </div>
        <div v-show="activeTab === 'analysis'" class="section-body">
          <div v-if="!paper.analysis" class="empty-hint">暂无论文分析，请先执行论文分析</div>
          <div v-else class="tex-content" v-html="renderMarkdown(paper.analysis)"></div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>选择一篇论文查看详情</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { PaperWithAnalysis } from '../../types/paper'
import { isAnalyzed as checkAnalyzed } from '../../types/paper'
import { useSummaryQueueStore } from '../../stores/analysisQueue'
import { useAnalysisQueueStore } from '../../stores/paperAnalysisQueue'
import { useToastStore } from '../../stores/toast'
import { usePapersStore } from '../../stores/papers'
import { renderLatex, renderMarkdown, renderMarkdownOnly } from '../../utils/katex'
import { formatDateFull, extractErrorMessage } from '../../utils/format'
import { listZoteroCollections, exportPaperToZotero } from '../../api'
import type { ZoteroCollection } from '../../api'
import 'katex/dist/katex.min.css'

const props = defineProps<{
  paper: PaperWithAnalysis | null
}>()

const queueStore = useSummaryQueueStore()
const analysisQueueStore = useAnalysisQueueStore()
const toastStore = useToastStore()
const papersStore = usePapersStore()

const activeTab = ref<'abstract' | 'summary' | 'analysis'>('abstract')
const isDownloadingPdf = ref(false)
const isPdfCached = ref(false)
const downloadProgress = ref(0)
const showZoteroMenu = ref(false)
const collections = ref<ZoteroCollection[]>([])
const zoteroError = ref('')
const loadingCollections = ref(false)
const exportingToZotero = ref(false)
const showMoreMenu = ref(false)

const hasSummary = computed(() => !!(props.paper?.summary && props.paper.summary.length > 0))
const hasAnalysis = computed(() => !!(props.paper?.analysis && props.paper.analysis.length > 0))

watch(() => props.paper?.id, async () => {
  if (!props.paper) { isPdfCached.value = false; return }
  try { isPdfCached.value = await (window as any).api.isPdfCached(props.paper.id) } catch { isPdfCached.value = false }
}, { immediate: true })

onMounted(() => {
  const cleanup = (window as any).api.onPdfDownloadProgress((data: { paperId: string; loaded: number; total?: number }) => {
    if (data.paperId !== props.paper?.id) return
    if (data.total) {
      downloadProgress.value = Math.round((data.loaded / data.total) * 100)
    } else {
      downloadProgress.value = Math.min(99, Math.round(data.loaded / 1024 / 10))
    }
  })
  onUnmounted(cleanup)
})

const isCurrentPaper = computed(() => {
  return props.paper ? queueStore.currentPaperId === props.paper.id : false
})

const isInQueue = computed(() => {
  return props.paper ? queueStore.isInQueue(props.paper.id) : false
})

const isAnalysisCurrentPaper = computed(() => {
  return props.paper ? analysisQueueStore.currentPaperId === props.paper.id : false
})

const isAnalysisInQueue = computed(() => {
  return props.paper ? analysisQueueStore.isInQueue(props.paper.id) : false
})

// Auto-switch to summary tab when paper becomes analyzed
watch(() => props.paper?.summary, (val) => {
  if (val && activeTab.value === 'abstract') activeTab.value = 'summary'
})

const isAnalyzed = computed(() => {
  if (!props.paper) return false
  return checkAnalyzed(props.paper)
})

const addToQueue = () => {
  if (!props.paper) return
  if (isInQueue.value) return
  queueStore.enqueue([{ id: props.paper.id, title: props.paper.title }])
}

const addToAnalysisQueue = () => {
  if (!props.paper) return
  if (isAnalysisInQueue.value) return
  analysisQueueStore.enqueue([{ id: props.paper.id, title: props.paper.title }])
}

const downloadPdf = async () => {
  if (!props.paper || isDownloadingPdf.value) return
  isDownloadingPdf.value = true
  downloadProgress.value = 0
  try {
    await (window as any).api.downloadPdf(props.paper.id)
    isPdfCached.value = true
  } catch (err) {
    console.error('Failed to download PDF:', err)
  } finally {
    isDownloadingPdf.value = false
    downloadProgress.value = 0
  }
}

const doDeletePdf = async () => {
  if (!props.paper || !isPdfCached.value) return
  showMoreMenu.value = false
  try {
    await (window as any).api.deletePdf(props.paper.id)
    isPdfCached.value = false
    toastStore.show('已删除', 'PDF 已删除', 'success')
  } catch (err) {
    toastStore.show('删除失败', '删除失败', 'error', extractErrorMessage(err))
  }
}

const doDeleteSummary = async () => {
  if (!props.paper || !hasSummary.value) return
  showMoreMenu.value = false
  try {
    await (window as any).api.deleteSummary(props.paper.id)
    papersStore.selectPaper(props.paper.id)
    toastStore.show('已删除', '论文总结已删除', 'success')
  } catch (err) {
    toastStore.show('删除失败', '删除失败', 'error', extractErrorMessage(err))
  }
}

const doDeleteAnalysis = async () => {
  if (!props.paper || !hasAnalysis.value) return
  showMoreMenu.value = false
  try {
    await (window as any).api.deleteAnalysis(props.paper.id)
    papersStore.selectPaper(props.paper.id)
    toastStore.show('已删除', '论文分析已删除', 'success')
  } catch (err) {
    toastStore.show('删除失败', '删除失败', 'error', extractErrorMessage(err))
  }
}

const toggleMenu = (menu: 'zotero' | 'more') => {
  if (menu === 'zotero') {
    showZoteroMenu.value = !showZoteroMenu.value
    showMoreMenu.value = false
  } else {
    showMoreMenu.value = !showMoreMenu.value
    showZoteroMenu.value = false
  }
}

const loadCollectionsIfNeeded = async () => {
  if (collections.value.length === 0 && !loadingCollections.value) {
    loadingCollections.value = true
    zoteroError.value = ''
    try {
      collections.value = await listZoteroCollections()
    } catch (err) {
      collections.value = []
      const msg = extractErrorMessage(err)
      if (msg.includes('未配置')) {
        zoteroError.value = '请先在设置中配置 Zotero'
        toastStore.show('未配置', '请先在设置中配置 Zotero', 'error')
      } else {
        zoteroError.value = 'Zotero 连接失败'
        toastStore.show('连接失败', '无法访问 Zotero', 'error', msg)
      }
    } finally {
      loadingCollections.value = false
    }
  }
}

const doExportToZotero = async (collectionKey: string) => {
  if (!props.paper || exportingToZotero.value) return
  exportingToZotero.value = true
  showZoteroMenu.value = false
  try {
    const summaryHtml = props.paper.summary ? renderMarkdownOnly(props.paper.summary) : undefined
    const analysisHtml = props.paper.analysis ? renderMarkdownOnly(props.paper.analysis) : undefined
    await exportPaperToZotero(props.paper.id, collectionKey, summaryHtml, analysisHtml)
    toastStore.show('导出成功', '已成功导出到 Zotero', 'success')
  } catch (err) {
    console.error('Failed to export to Zotero:', err)
    toastStore.show('导出失败', '导出到 Zotero 失败', 'error', extractErrorMessage(err))
  } finally {
    exportingToZotero.value = false
  }
}

// Close zotero menu on outside click
const onDocClick = (e: MouseEvent) => {
  if (!showZoteroMenu.value && !showMoreMenu.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.zotero-export-wrapper') && !target.closest('.more-wrapper')) {
    showZoteroMenu.value = false
    showMoreMenu.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.detail-panel {
  width: 100%;
  min-width: 280px;
  flex: 1;
  overflow-y: auto;
}

.detail-content {
  padding: 24px;
}

.detail-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 16px;
}

.detail-meta {
  color: var(--text-tertiary);
  font-size: 14px;
  margin-bottom: 16px;
}

.detail-meta p {
  margin-bottom: 4px;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.action-link {
  padding: 6px 14px;
  min-width: 80px;
  height: 30px;
  text-align: center;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-sizing: border-box;
}

.action-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-link:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--border-secondary);
}

.action-pdf {
  color: var(--text-secondary);
  border-color: var(--text-tertiary);
}

.action-pdf:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--text-secondary);
}

.action-analyze {
  color: var(--color-success);
  border-color: var(--color-success);
}

.action-analyze:hover:not(:disabled) {
  background: var(--color-success-bg);
}

.action-deep {
  color: var(--color-deep);
  border-color: var(--color-deep-border);
}

.action-deep:hover:not(:disabled) {
  background: var(--color-deep-bg);
  border-color: var(--color-deep-border);
}

.action-zotero {
  color: var(--color-danger);
  border-color: var(--color-danger-border);
}

.action-zotero:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-hover);
}

.zotero-export-wrapper {
  position: relative;
  display: inline-block;
}

.zotero-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 180px;
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-md);
  z-index: 50;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px 0;
}

.zotero-menu-loading,
.zotero-menu-empty {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-placeholder);
}

.zotero-menu-item {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.zotero-menu-item:hover {
  background: var(--bg-tertiary);
}

.zotero-menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.more-wrapper {
  position: relative;
  display: inline-block;
}

.action-more {
  padding: 6px 10px;
  min-width: auto;
  border: 1px solid var(--border-primary);
  height: 30px;
}

/* Tabs */
.detail-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-primary);
  margin-bottom: 0;
}

.tab-item {
  padding: 8px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: -1px;
}

.tab-item:hover {
  color: var(--text-secondary);
}

.tab-item.active {
  color: var(--text-primary);
  border-bottom-color: var(--color-primary);
}

/* Sections */
.detail-section {
  margin-bottom: 0;
}

.section-body {
  padding: 16px 0;
}

.empty-hint {
  color: var(--text-placeholder);
  font-size: 14px;
  text-align: center;
  padding: 32px 0;
}

/* TeX content */
.tex-content {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.tex-content :deep(p) {
  margin: 0 0 8px 0;
}

.tex-content :deep(p:last-child) {
  margin-bottom: 0;
}

.tex-content :deep(ul),
.tex-content :deep(ol) {
  margin: 0 0 8px 0;
  padding-left: 20px;
}

.tex-content :deep(li) {
  margin-bottom: 4px;
}

.tex-content :deep(strong) {
  color: var(--text-primary);
}

.tex-content :deep(h1),
.tex-content :deep(h2),
.tex-content :deep(h3),
.tex-content :deep(h4) {
  color: var(--text-primary);
  margin: 12px 0 6px 0;
}

.tex-content :deep(h1) { font-size: 18px; }
.tex-content :deep(h2) { font-size: 17px; }
.tex-content :deep(h3) { font-size: 16px; }

.tex-content :deep(.katex-display) {
  margin: 12px 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.tex-content :deep(.katex) {
  font-size: 1.05em;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-placeholder);
  font-size: 14px;
}
</style>
