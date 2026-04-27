<template>
  <div class="paper-filters">
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        placeholder="搜索论文..."
        v-model="searchQuery"
        @input="onSearch"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const emit = defineEmits<{
  (e: 'search', query: string): void
}>()

const searchQuery = ref('')

let debounceTimer: number | null = null

const onSearch = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    emit('search', searchQuery.value)
  }, 300)
}

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.paper-filters {
  margin-bottom: 20px;
}

.search-bar {
  display: flex;
  align-items: center;
  background: #f9fafb;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 0 12px;
}

.search-icon {
  font-size: 14px;
  color: #9ca3af;
  margin-right: 8px;
}

.search-bar input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 0;
  font-size: 14px;
  outline: none;
}

.search-bar input::placeholder {
  color: #9ca3af;
}
</style>
