<template>
  <div class="paper-card" :class="{ selected: isSelected }" @click="selectPaper">
    <div class="card-header">
      <h3 class="paper-title">{{ paper.title }}</h3>
      <span class="paper-date">{{ formatDate(paper.published_date) }}</span>
    </div>
    <p class="paper-authors">{{ formatAuthors(paper.authors) }}</p>
    <div class="card-footer">
      <div class="paper-categories">
        <span v-for="cat in paper.categories" :key="cat" class="category-tag">{{ cat }}</span>
      </div>
      <span class="status-indicator" :class="{ analyzed: isAnalyzed(paper), failed: isFailedAnalysis(paper) }">
        {{ isAnalyzed(paper) ? '已分析' : isFailedAnalysis(paper) ? '分析失败' : '未分析' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePapersStore } from '../../stores/papers'
import type { PaperWithAnalysis } from '../../types/paper'
import { isAnalyzed, isFailedAnalysis } from '../../types/paper'
import { formatDate } from '../../utils/format'

const props = defineProps<{
  paper: PaperWithAnalysis
}>()

const emit = defineEmits<{
  (e: 'select', paperId: string): void
}>()

const papersStore = usePapersStore()
const isSelected = computed(() => papersStore.selectedPaperId === props.paper.id)

const selectPaper = () => emit('select', props.paper.id)

const formatAuthors = (authors: string[]) => {
  if (authors.length <= 2) return authors.join(', ')
  return `${authors[0]}, ${authors[1]} et al.`
}
</script>

<style scoped>
.paper-card {
  background: #ffffff;
  padding: 14px 16px;
  margin-bottom: 0;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.15s;
}

.paper-card:hover {
  background: #f9fafb;
}

.paper-card.selected {
  background: #eff6ff;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.paper-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
  flex: 1;
  margin-right: 12px;
}

.paper-date {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

.paper-authors {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.paper-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.category-tag {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.status-indicator {
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
}

.status-indicator.analyzed {
  color: #10b981;
}

.status-indicator.failed {
  color: #dc2626;
}
</style>
