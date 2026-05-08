import { defineStore } from 'pinia'
import { getPaperDetail } from '../api'
import { usePapersStore } from './papers'
import { useProgressStore } from './progress'
import { useToastStore } from './toast'
import { createProcessingQueue, type QueueItem } from './createProcessingQueue'

export type { QueueItem }

export const useSummaryQueueStore = defineStore('summaryQueue', () => {
  const progressStore = useProgressStore()

  const queue = createProcessingQueue({
    name: 'SummaryQueue',
    processItem: async (item) => {
      progressStore.currentPaper = item.title
      updateProgress()

      const result = await window.api.summarizePaper(item.id, false)
      if (result.cancelled) return result

      useToastStore().show('总结完成', item.title, 'success')

      try {
        const papersStore = usePapersStore()
        const updated = await getPaperDetail(item.id)
        const idx = papersStore.papers.findIndex(p => p.id === item.id)
        if (idx !== -1) {
          papersStore.papers.splice(idx, 1, updated)
        } else if (papersStore.selectedPaperId === item.id) {
          papersStore.selectPaper(item.id)
        }
      } catch {
        // Non-fatal: list refresh failed
      }

      updateProgress()
    },
    stopApi: () => window.api.stopSummary(),
    onCompleteAll: async () => {
      await usePapersStore().loadPapers()
    },
  })

  function updateProgress(): void {
    const done = queue.completedCount.value + queue.errorCount.value
    const remaining = queue.queue.value.length + (queue.currentPaperId.value ? 1 : 0)
    progressStore.progressCurrent = done
    progressStore.progressTotal = done + remaining
  }

  function startProcessing(): void {
    progressStore.isAnalyzing = true
    progressStore.progressPhase = '正在生成论文总结...'
    progressStore.lastError = ''
    queue.processQueue().finally(() => {
      progressStore.isAnalyzing = false
      progressStore.progressPhase = ''
      progressStore.currentPaper = ''
      progressStore.lastError = ''
    })
  }

  // Override enqueue to start processing
  const originalEnqueue = queue.enqueue.bind(queue)
  function enqueue(items: QueueItem[]): number {
    const added = originalEnqueue(items)
    if (added > 0 && !queue.isRunning.value) {
      startProcessing()
    }
    return added
  }

  return {
    queue: queue.queue,
    currentPaperId: queue.currentPaperId,
    currentPaperTitle: queue.currentPaperTitle,
    isRunning: queue.isRunning,
    completedCount: queue.completedCount,
    errorCount: queue.errorCount,
    initialTotal: queue.initialTotal,
    isInQueue: queue.isInQueue,
    enqueue,
    requestStop: queue.requestStop,
    cancelCurrent: queue.cancelCurrent,
    remove: queue.remove,
    clear: queue.clear,
    updateProgress,
  }
})
