import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPaperDetail } from '../api'
import { usePapersStore } from './papers'
import { useProgressStore } from './progress'
import { useToastStore } from './toast'
import { truncate } from '../utils/format'

export interface QueueItem {
  id: string
  title: string
}

export const useSummaryQueueStore = defineStore('summaryQueue', () => {
  const queue = ref<QueueItem[]>([])
  const currentPaperId = ref<string | null>(null)
  const currentPaperTitle = ref('')
  const isRunning = ref(false)
  const stopRequested = ref(false)
  const completedCount = ref(0)
  const errorCount = ref(0)
  const initialTotal = ref(0)

  function isInQueue(paperId: string): boolean {
    return currentPaperId.value === paperId || queue.value.some(item => item.id === paperId)
  }

  function enqueue(items: QueueItem[]): number {
    const existing = new Set([
      ...queue.value.map(i => i.id),
      ...(currentPaperId.value ? [currentPaperId.value] : []),
    ])
    let added = 0
    for (const item of items) {
      if (!existing.has(item.id)) {
        queue.value.push(item)
        existing.add(item.id)
        added++
      }
    }
    if (!isRunning.value && queue.value.length > 0) {
      processQueue().catch(err => console.error('[SummaryQueue] Unhandled error:', err))
    }
    return added
  }

  function requestStop(): void {
    stopRequested.value = true
    window.api.stopSummary()
  }

  function cancelCurrent(): void {
    window.api.stopSummary()
  }

  function remove(paperId: string): void {
    const item = queue.value.find(i => i.id === paperId)
    if (item) {
      useToastStore().show('已取消', truncate(item.title), 'info')
      queue.value = queue.value.filter(i => i.id !== paperId)
    }
  }

  function clear(): void {
    stopRequested.value = true
    const count = queue.value.length + (currentPaperId.value ? 1 : 0)
    if (count > 0) {
      useToastStore().show('已取消', `已取消 ${count} 篇待分析论文`, 'info')
    }
    queue.value = []
  }

  async function processQueue(): Promise<void> {
    if (isRunning.value) return
    isRunning.value = true
    stopRequested.value = false
    completedCount.value = 0
    errorCount.value = 0
    initialTotal.value = queue.value.length

    const papersStore = usePapersStore()
    const progressStore = useProgressStore()

    progressStore.isAnalyzing = true
    progressStore.progressPhase = '正在生成论文总结...'
    progressStore.lastError = ''

    try {
      while (queue.value.length > 0 && !stopRequested.value) {
        const [item, ...rest] = queue.value
        queue.value = rest
        currentPaperId.value = item.id
        currentPaperTitle.value = item.title

        progressStore.currentPaper = item.title
        updateProgress()

        try {
          const result = await window.api.summarizePaper(item.id, false)

          if (result.cancelled) {
            if (!stopRequested.value) {
              useToastStore().show('已取消', truncate(item.title), 'info')
            }
            continue
          }

          completedCount.value++
          useToastStore().show('总结完成', truncate(item.title), 'success')

          try {
            const updated = await getPaperDetail(item.id)
            const idx = papersStore.papers.findIndex(p => p.id === item.id)
            if (idx !== -1) {
              papersStore.papers.splice(idx, 1, updated)
            }
          } catch {
            // Non-fatal: list refresh failed
          }
        } catch (err) {
          errorCount.value++
          const msg = err instanceof Error ? err.message : String(err)
          progressStore.lastError = msg
          console.error(`[SummaryQueue] Error for paper ${item.id}: ${msg}`)
        }

        updateProgress()
      }

      await papersStore.loadPapers()
    } finally {
      currentPaperId.value = null
      currentPaperTitle.value = ''
      isRunning.value = false
      progressStore.isAnalyzing = false
      progressStore.progressPhase = ''
      progressStore.currentPaper = ''
      progressStore.lastError = ''
    }
  }

  function updateProgress(): void {
    const done = completedCount.value + errorCount.value
    const remaining = queue.value.length + (currentPaperId.value ? 1 : 0)
    const progressStore = useProgressStore()
    progressStore.progressCurrent = done
    progressStore.progressTotal = done + remaining
  }

  return {
    queue,
    currentPaperId,
    currentPaperTitle,
    isRunning,
    completedCount,
    errorCount,
    initialTotal,
    isInQueue,
    enqueue,
    requestStop,
    cancelCurrent,
    remove,
    clear,
    updateProgress,
  }
})
