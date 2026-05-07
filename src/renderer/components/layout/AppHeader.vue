<template>
  <header ref="headerRef" class="app-header" :class="{ 'no-titlebar-indent': !isMac }">
    <div class="header-center">
      <div class="search-bar">
        <Search :size="14" class="search-icon" />
        <input
          ref="searchInput"
          type="text"
          placeholder="搜索论文..."
          :value="papersStore.searchQuery"
          @input="onSearch"
        />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Search } from 'lucide-vue-next'
import { usePapersStore } from '../../stores/papers'

const isMac = navigator.userAgentData?.platform === 'macOS'
  || navigator.platform.toUpperCase().indexOf('MAC') >= 0
const papersStore = usePapersStore()
const headerRef = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

let debounceTimer: number | null = null

const onSearch = (e: Event) => {
  const value = (e.target as HTMLInputElement).value
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    papersStore.loadPapers({ search: value })
  }, 300)
}

const onHeaderClick = (e: Event) => {
  const target = e.target as HTMLElement
  if (!target.closest('.header-center')) {
    searchInput.value?.blur()
  }
}

onMounted(() => {
  headerRef.value?.addEventListener('click', onHeaderClick)
})

onUnmounted(() => {
  headerRef.value?.removeEventListener('click', onHeaderClick)
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.app-header {
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
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
  display: flex;
  align-items: center;
  background: #f9fafb;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 0 10px;
}

.search-icon {
  flex-shrink: 0;
  margin-right: 6px;
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
  color: #9ca3af;
}
</style>
