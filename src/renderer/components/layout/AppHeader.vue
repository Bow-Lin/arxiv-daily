<template>
  <header class="app-header" :class="{ 'no-titlebar-indent': !isMac }">
    <div class="header-center">
      <div class="search-bar">
        <Search :size="14" class="search-icon" />
        <input
          ref="searchInput"
          type="text"
          placeholder="搜索论文..."
          :value="activeStore.searchQuery"
          @input="onSearch"
        />
        <button v-if="activeStore.searchQuery" class="search-clear" @click="clearSearch">
          <X :size="14" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { usePapersStore } from '../../stores/papers'
import { useConferencePapersStore } from '../../stores/conference-papers'
import { useModeStore } from '../../stores/mode'

const isMac = (navigator as any).userAgentData?.platform === 'macOS'
const papersStore = usePapersStore()
const conferenceStore = useConferencePapersStore()
const modeStore = useModeStore()
const searchInput = ref<HTMLInputElement | null>(null)

const activeStore = computed(() => modeStore.isConference ? conferenceStore : papersStore)

let debounceTimer: number | null = null

const onSearch = (e: Event) => {
  const value = (e.target as HTMLInputElement).value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    activeStore.value.loadPapers({ search: value })
  }, 300)
}

const clearSearch = () => {
  activeStore.value.loadPapers({ search: '' })
  searchInput.value?.focus()
}

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.app-header {
  height: 48px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 80px 0 80px;
  -webkit-app-region: drag;
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-header.no-titlebar-indent {
  padding-left: 24px;
}

.header-center {
  width: 400px;
  max-width: 100%;
  -webkit-app-region: no-drag;
}

.search-bar {
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 0 10px;
}

.search-icon {
  flex-shrink: 0;
  margin-right: 6px;
}

.search-clear {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  margin-right: -6px;
  border: none;
  background: transparent;
  color: var(--text-placeholder);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.search-clear:hover {
  color: var(--text-tertiary);
}

.search-bar input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 0;
  font-size: 13px;
  outline: none;
}

.search-bar input::placeholder {
  color: var(--text-placeholder);
}
</style>
