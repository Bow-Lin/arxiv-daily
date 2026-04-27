<template>
  <div class="detail-panel">
    <div v-if="paper" class="detail-content">
      <h2 class="detail-title">{{ paper.title }}</h2>

      <div class="detail-meta">
        <p><strong>作者:</strong> {{ paper.authors.join(', ') }}</p>
        <p><strong>分类:</strong> {{ paper.categories.join(', ') }}</p>
        <p><strong>发布:</strong> {{ formatDate(paper.published_date) }}</p>
        <p><strong>arXiv ID:</strong> {{ paper.id }}</p>
      </div>

      <div class="detail-actions">
        <a :href="paper.url" target="_blank" rel="noopener noreferrer" class="action-link">arXiv</a>
        <a :href="paper.pdf_url" target="_blank" rel="noopener noreferrer" class="action-link">PDF</a>
        <button class="action-link action-analyze" :disabled="isInQueue" @click="addToQueue">
          {{ isCurrentPaper ? '分析中...' : isInQueue ? '排队中...' : '分析论文' }}
        </button>
        <button class="action-link action-deep" :disabled="isAnalysisInQueue" @click="addToAnalysisQueue">
          {{ isAnalysisCurrentPaper ? '分析中...' : isAnalysisInQueue ? '排队中...' : '论文分析' }}
        </button>
      </div>

      <!-- Section 1: Abstract -->
      <div class="detail-section">
        <div class="section-header" @click="abstractExpanded = !abstractExpanded">
          <h4 class="section-title">论文摘要</h4>
          <span class="section-arrow">{{ abstractExpanded ? '▾' : '▸' }}</span>
        </div>
        <div v-show="abstractExpanded" class="section-body">
          <div class="tex-content" v-html="renderLatex(paper.abstract_text)"></div>
        </div>
      </div>

      <!-- Section 2: Analysis -->
      <div v-if="isAnalyzed" class="detail-section">
        <div class="section-header" @click="analysisExpanded = !analysisExpanded">
          <h4 class="section-title">论文总结</h4>
          <span class="section-arrow">{{ analysisExpanded ? '▾' : '▸' }}</span>
        </div>
        <div v-show="analysisExpanded" class="section-body">
          <div class="tex-content" v-html="renderMarkdown(paper.summary || '')"></div>
        </div>
      </div>

      <!-- Section 3: Deep Analysis -->
      <div v-if="paper.analysis" class="detail-section">
        <div class="section-header" @click="deepExpanded = !deepExpanded">
          <h4 class="section-title">论文分析</h4>
          <span class="section-arrow">{{ deepExpanded ? '▾' : '▸' }}</span>
        </div>
        <div v-show="deepExpanded" class="section-body">
          <div class="tex-content" v-html="renderMarkdown(paper.analysis)"></div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>选择一篇论文查看详情</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PaperWithAnalysis } from '../../types/paper'
import { isAnalyzed as checkAnalyzed } from '../../types/paper'
import { useSummaryQueueStore } from '../../stores/analysisQueue'
import { useAnalysisQueueStore } from '../../stores/paperAnalysisQueue'
import { renderLatex, renderMarkdown } from '../../utils/katex'
import { formatDate } from '../../utils/format'
import 'katex/dist/katex.min.css'

const props = defineProps<{
  paper: PaperWithAnalysis | null
}>()

const queueStore = useSummaryQueueStore()
const analysisQueueStore = useAnalysisQueueStore()

const abstractExpanded = ref(true)
const analysisExpanded = ref(true)
const deepExpanded = ref(true)

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
  color: #6b7280;
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
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #ffffff;
  color: #4b5563;
  text-decoration: none;
  font-size: 13px;
  cursor: pointer;
}

.action-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-link:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.action-analyze {
  color: #059669;
  border-color: #059669;
}

.action-analyze:hover:not(:disabled) {
  background: #ecfdf5;
}

.action-deep {
  color: #7c3aed;
  border-color: #c4b5fd;
}

.action-deep:hover:not(:disabled) {
  background: #f5f3ff;
  border-color: #a78bfa;
}

/* Collapsible sections */
.detail-section {
  margin-bottom: 0;
}

.detail-section + .detail-section {
  border-top: 1px solid #e8e8e8;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  cursor: pointer;
  user-select: none;
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.section-arrow {
  font-size: 12px;
  color: #9ca3af;
  margin-left: auto;
}

.section-body {
  padding-bottom: 16px;
}

/* TeX content */
.tex-content {
  font-size: 15px;
  line-height: 1.7;
  color: #4b5563;
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
  color: #1a1a1a;
}

.tex-content :deep(h1),
.tex-content :deep(h2),
.tex-content :deep(h3),
.tex-content :deep(h4) {
  color: #1a1a1a;
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
  color: #9ca3af;
  font-size: 14px;
}
</style>
