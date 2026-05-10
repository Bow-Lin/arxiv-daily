<template>
  <div class="paper-list">
    <div class="paper-list-header">
      <!-- arxiv: topic filter -->
      <div v-if="!modeStore.isConference" class="filter-row">
        <span class="filter-label">话题</span>
        <div class="filter-tags">
          <span
            v-for="topic in enabledTopics"
            :key="topic.id"
            class="topic-tag"
            :class="{ active: papersStore.selectedTopicIds.includes(topic.id) }"
            @click="papersStore.selectTopic(topic.id)"
          >
            {{ topic.name }}
          </span>
        </div>
      </div>

      <!-- conference: topic + track filter -->
      <template v-else>
        <div class="filter-row">
          <span class="filter-label">话题</span>
          <div class="filter-tags">
            <span
              v-for="topic in enabledTopics"
              :key="topic.id"
              class="topic-tag"
              :class="{ active: conferenceStore.selectedTopicIds.includes(topic.id) }"
              @click="conferenceStore.selectTopic(topic.id)"
            >
              {{ topic.name }}
            </span>
          </div>
        </div>
        <div v-if="conferenceStore.tracks.length > 0" class="filter-row filter-row--sub">
          <span class="filter-label">类型</span>
          <div class="filter-tags">
            <span
              v-for="t in conferenceStore.tracks"
              :key="t.track"
              class="topic-tag"
              :class="{ active: conferenceStore.selectedTracks.includes(t.track) }"
              @click="conferenceStore.toggleTrack(t.track)"
            >
              {{ t.track }}
            </span>
          </div>
        </div>
      </template>

      <p v-if="!activeStore.loading && activeStore.papers.length > 0" class="result-summary">
        共 {{ activeStore.pagination.total }} 篇论文
      </p>
    </div>

    <div class="paper-list-scroll" ref="scrollRef" @scroll="onScroll">
      <LoadingSpinner v-if="activeStore.loading && activeStore.papers.length === 0" />

      <div v-else-if="activeStore.error && activeStore.papers.length === 0" class="error-state">
        <p>{{ activeStore.error }}</p>
        <button class="retry-btn" @click="retry">重试</button>
      </div>

      <div v-else-if="activeStore.papers.length === 0" class="empty-state">
        <p>未找到相关论文</p>
      </div>

      <template v-else>
        <PaperCard
          v-for="paper in activeStore.papers"
          :key="paper.id"
          :paper="paper"
          @select="selectPaper"
        />

        <div v-if="loadingMore" class="loading-more">
          <LoadingSpinner />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PaperCard from './PaperCard.vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'
import { usePapersStore } from '../../stores/papers'
import { useConferencePapersStore } from '../../stores/conference-papers'
import { useModeStore } from '../../stores/mode'
import { useConfigStore } from '../../stores/config'

const papersStore = usePapersStore()
const conferenceStore = useConferencePapersStore()
const modeStore = useModeStore()
const configStore = useConfigStore()
const loadingMore = ref(false)
const scrollRef = ref<HTMLElement | null>(null)

const activeStore = computed(() => modeStore.isConference ? conferenceStore : papersStore)


const hasMore = computed(() => {
  return activeStore.value.papers.length < activeStore.value.pagination.total
})

const enabledTopics = computed(() => {
  return configStore.topics.filter(t => t.enabled)
})

const emit = defineEmits<{
  (e: 'select', paperId: string): void
}>()

const selectPaper = (paperId: string) => emit('select', paperId)

const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    await activeStore.value.loadPapers({ page: activeStore.value.pagination.page + 1 })
  } finally {
    loadingMore.value = false
  }
}

const onScroll = () => {
  if (loadingMore.value || !hasMore.value) return
  const el = scrollRef.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
    loadMore()
  }
}

const retry = () => {
  activeStore.value.loadPapers()
}
</script>

<style scoped>
.paper-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.paper-list-header {
  flex-shrink: 0;
  padding: 4px 12px 4px;
  border-bottom: 1px solid var(--border-primary);
}

.paper-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 24px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  min-height: 32px;
}

.filter-row--sub {
  margin-top: 2px;
}

.filter-label {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
  flex-shrink: 0;
}

.filter-tags {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.filter-tags::-webkit-scrollbar {
  display: none;
}

.topic-tag {
  padding: 6px 10px;
  background: var(--tag-bg);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.topic-tag.active {
  background: var(--tag-active-bg);
  color: var(--tag-active-text);
}

.result-summary {
  font-size: 13px;
  color: var(--text-placeholder);
  margin: 8px 0 0;
}

.loading-more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.empty-state,
.error-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.empty-state p,
.error-state p {
  margin-bottom: 16px;
  font-size: 14px;
}

.retry-btn {
  padding: 8px 24px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.retry-btn:hover {
  background: var(--color-primary-hover);
}
</style>
