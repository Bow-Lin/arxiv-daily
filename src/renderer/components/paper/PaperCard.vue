<template>
  <div class="paper-card" :class="{ selected: isPaperSelected }" @click="onCardClick">
    <div class="card-header">
      <h3 class="paper-title">{{ paper.title }}</h3>
      <span class="status-indicator" :class="{ analyzed: isAnalyzed(paper), failed: isFailedAnalysis(paper) }">
        {{ isAnalyzed(paper) ? '已分析' : isFailedAnalysis(paper) ? '分析失败' : '未分析' }}
      </span>
    </div>
    <div class="card-middle">
      <p class="paper-authors">{{ formatAuthors(paper.authors) }}</p>
      <span class="paper-meta">
        <template v-if="isConferencePaper(paper) && paper.track">{{ paper.track }}</template>
        <template v-else-if="!isConferencePaper(paper)">{{ formatDate(paper.updated_date) }}</template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePapersStore } from '../../stores/papers'
import { useConferencePapersStore } from '../../stores/conference-papers'
import { useModeStore } from '../../stores/mode'
import type { PaperWithAnalysis } from '../../types/paper'
import { isAnalyzed, isFailedAnalysis } from '../../types/paper'
import { formatDate } from '../../utils/format'

type PaperLike = PaperWithAnalysis | ConferencePaper

function isConferencePaper(paper: PaperLike): paper is ConferencePaper {
  return 'conference_id' in paper
}

const props = defineProps<{
  paper: PaperLike
}>()

const emit = defineEmits<{
  (e: 'select', paperId: string): void
}>()

const papersStore = usePapersStore()
const conferenceStore = useConferencePapersStore()
const modeStore = useModeStore()

const isPaperSelected = computed(() => {
  const ids = modeStore.isConference
    ? conferenceStore.selectedPaperIds
    : papersStore.selectedPaperIds
  return ids.includes(props.paper.id)
})

const onCardClick = (e: MouseEvent) => {
  if (e.metaKey || e.ctrlKey) {
    if (modeStore.isConference) {
      conferenceStore.toggleSelection(props.paper.id)
    } else {
      papersStore.toggleSelection(props.paper.id)
    }
  } else {
    if (modeStore.isConference) {
      conferenceStore.clearSelection()
      conferenceStore.selectedPaperIds.push(props.paper.id)
    } else {
      papersStore.clearSelection()
      papersStore.selectedPaperIds.push(props.paper.id)
    }
    emit('select', props.paper.id)
  }
}

const formatAuthors = (authors: string[]) => {
  if (authors.length <= 1) return authors[0] ?? ''
  return `${authors[0]}, et al.`
}
</script>

<style scoped>
.paper-card {
  background: var(--card-bg);
  padding: 14px 16px;
  margin-bottom: 0;
  cursor: pointer;
  border-bottom: 1px solid var(--card-border);
  transition: background 0.15s;
}

.paper-card:hover {
  background: var(--card-hover);
}

.paper-card.selected {
  background: var(--card-selected);
}

.paper-card.selected .paper-meta,
.paper-card.selected .paper-authors,
.paper-card.selected .status-indicator {
  color: var(--card-selected-text);
  border-color: var(--card-selected-text);
}

.paper-card.selected .status-indicator.analyzed {
  color: var(--badge-success);
  border-color: var(--badge-success);
}

.paper-card.selected .status-indicator.failed {
  color: var(--color-error);
  border-color: var(--color-error);
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
  color: var(--text-secondary);
  line-height: 1.4;
  flex: 1;
  margin-right: 12px;
}

.paper-meta {
  font-size: 14px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.card-middle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.paper-authors {
  font-size: 14px;
  color: var(--text-tertiary);
  flex: 1;
  min-width: 0;
}

.status-indicator {
  font-size: 12px;
  color: var(--text-tertiary);
  border: 1px solid var(--text-tertiary);
  border-radius: 4px;
  padding: 1px 6px;
  flex-shrink: 0;
  white-space: nowrap;
}

.status-indicator.analyzed {
  color: var(--badge-success);
  border-color: var(--badge-success);
}

.status-indicator.failed {
  color: var(--color-error);
  border-color: var(--color-error);
}

.track-badge {
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--category-bg);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
</style>
