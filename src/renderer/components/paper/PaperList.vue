<template>
  <div class="paper-list">
    <div class="paper-list-header">
      <div class="topic-tags">
        <span
          class="topic-tag"
          :class="{ active: !papersStore.selectedTopicId }"
          @click="papersStore.selectTopic(null)"
        >
          全部
        </span>
        <span
          v-for="topic in enabledTopics"
          :key="topic.id"
          class="topic-tag"
          :class="{ active: papersStore.selectedTopicId === topic.id }"
          @click="papersStore.selectTopic(topic.id)"
        >
          {{ topic.name }}
        </span>
      </div>

      <p v-if="!papersStore.loading && papersStore.papers.length > 0" class="result-summary">
        共 {{ papersStore.pagination.total }} 篇论文
      </p>
    </div>

    <div class="paper-list-scroll" ref="scrollRef" @scroll="onScroll">
      <LoadingSpinner v-if="papersStore.loading && papersStore.papers.length === 0" />

      <div v-else-if="papersStore.error && papersStore.papers.length === 0" class="error-state">
        <p>{{ papersStore.error }}</p>
        <button class="retry-btn" @click="retry">重试</button>
      </div>

      <div v-else-if="papersStore.papers.length === 0" class="empty-state">
        <p>未找到相关论文</p>
      </div>

      <template v-else>
        <PaperCard
          v-for="paper in papersStore.papers"
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
import { useConfigStore } from '../../stores/config'

const papersStore = usePapersStore()
const configStore = useConfigStore()
const loadingMore = ref(false)
const scrollRef = ref<HTMLElement | null>(null)

const hasMore = computed(() => {
  return papersStore.papers.length < papersStore.pagination.total
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
    await papersStore.loadPapers({ page: papersStore.pagination.page + 1 })
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
  papersStore.loadPapers()
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

.topic-tags {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.topic-tag {
  padding: 6px 12px;
  background: var(--tag-bg);
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.topic-tag.active {
  background: var(--tag-active-bg);
  color: var(--tag-active-text);
}

.result-summary {
  font-size: 13px;
  color: var(--text-placeholder);
  margin: 12px 0 0;
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
