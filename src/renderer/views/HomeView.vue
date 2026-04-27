<template>
  <div class="home-view">
    <AppHeader />
    <div class="content-wrapper">
      <div class="panel-wrapper sidebar-wrapper">
        <Sidebar />
      </div>
      <div class="divider"></div>
      <MainContent>
        <PaperList @select="handleSelect" />
      </MainContent>
      <div class="resize-bar" @mousedown="startResize"></div>
      <div class="panel-wrapper detail-wrapper" ref="detailRef">
        <PaperDetail :paper="papersStore.selectedPaper" @close="papersStore.clearSelection" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import AppHeader from '../components/layout/AppHeader.vue'
import Sidebar from '../components/layout/Sidebar.vue'
import MainContent from '../components/layout/MainContent.vue'
import PaperList from '../components/paper/PaperList.vue'
import PaperDetail from '../components/paper/PaperDetail.vue'
import { usePapersStore } from '../stores/papers'

const papersStore = usePapersStore()
const detailRef = ref<HTMLElement | null>(null)

const handleSelect = (paperId: string) => {
  papersStore.selectPaper(paperId)
}

let startX = 0
let startWidth = 0

const getMainEl = () => document.querySelector('.main-content') as HTMLElement

const startResize = (e: MouseEvent) => {
  e.preventDefault()
  startX = e.clientX
  const bars = document.querySelectorAll('.resize-bar')
  bars[0]?.classList.add('active')

  const main = getMainEl()
  startWidth = main?.offsetWidth || 0
  if (main) {
    main.style.flexBasis = startWidth + 'px'
    main.style.flexGrow = '0'
    main.style.flexShrink = '1'
    main.style.maxWidth = '800px'
  }

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onResize = (e: MouseEvent) => {
  const diff = e.clientX - startX
  const main = getMainEl()
  if (!main) return
  const maxW = window.innerWidth - 240 - 300 - 2
  const newWidth = Math.max(300, Math.min(startWidth + diff, maxW))
  main.style.flexBasis = newWidth + 'px'
}

const stopResize = () => {
  document.querySelectorAll('.resize-bar.active').forEach(b => b.classList.remove('active'))
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onUnmounted(() => {
  stopResize()
})
</script>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.content-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-width: 842px;
}

.panel-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-wrapper {
  width: 240px;
  flex-shrink: 0;
}

.detail-wrapper {
  flex: 1;
  min-width: 300px;
}

.divider {
  width: 1px;
  background: #e0e0e0;
  flex-shrink: 0;
}

.resize-bar {
  width: 1px;
  cursor: col-resize;
  background: #e0e0e0;
  flex-shrink: 0;
  transition: background 0.15s, width 0.15s;
  position: relative;
}

.resize-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: -3px;
  right: -3px;
  bottom: 0;
}

.resize-bar:hover,
.resize-bar.active {
  background: #2563eb;
  width: 1px;
}
</style>
