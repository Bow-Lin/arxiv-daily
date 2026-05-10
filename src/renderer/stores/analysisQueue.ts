import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getConferencePaperDetail, getPaperDetail } from '../api'
import { usePapersStore } from './papers'
import { useConferencePapersStore } from './conference-papers'
import { useToastStore } from './toast'
import { useDownloadQueueStore } from './downloadQueue'
import { createProcessingQueue, type QueueItem } from './createProcessingQueue'

export type { QueueItem }

export const useAnalysisQueueStore = defineStore('analysisQueue', () => {
  const progressPhase = ref('')

  const queue = createProcessingQueue({
    name: 'AnalysisQueue',
    processItem: async (item) => {
      const downloadStore = useDownloadQueueStore()
      await downloadStore.waitForDownload(item.id)

      const offProgress = window.api.onAnalysisProgress((phase: string) => {
        progressPhase.value = phase
      })

      try {
        let result: { success: boolean; cancelled?: boolean }
        if (item.conference) {
          result = await window.api.conferenceAnalyzeFullPaper(item.id)
        } else {
          result = await window.api.analyzeFullPaper(item.id)
        }
        if (result.cancelled) return result

        useToastStore().show('分析完成', item.title, 'success')

        try {
          if (item.conference) {
            const conferenceStore = useConferencePapersStore()
            const updated = await getConferencePaperDetail(item.id)
            const idx = conferenceStore.papers.findIndex(p => p.id === item.id)
            if (idx !== -1) {
              conferenceStore.papers.splice(idx, 1, updated)
            } else if (conferenceStore.selectedPaperIds.includes(item.id)) {
              conferenceStore.selectPaper(item.id)
            }
          } else {
            const papersStore = usePapersStore()
            const updated = await getPaperDetail(item.id)
            const idx = papersStore.papers.findIndex(p => p.id === item.id)
            if (idx !== -1) {
              papersStore.papers.splice(idx, 1, updated)
            } else if (papersStore.selectedPaperIds.includes(item.id)) {
              papersStore.selectPaper(item.id)
            }
          }
        } catch {
          // Non-fatal
        }
      } finally {
        offProgress()
        progressPhase.value = ''
      }
    },
    stopApi: () => {
      return queue.currentItem.value?.conference
        ? window.api.conferenceStopAnalysis()
        : window.api.stopAnalysis()
    },
  })

  return {
    queue: queue.queue,
    currentPaperId: queue.currentPaperId,
    currentPaperTitle: queue.currentPaperTitle,
    isRunning: queue.isRunning,
    completedCount: queue.completedCount,
    errorCount: queue.errorCount,
    initialTotal: queue.initialTotal,
    progressPhase,
    isInQueue: queue.isInQueue,
    enqueue: queue.enqueue,
    requestStop: queue.requestStop,
    cancelCurrent: queue.cancelCurrent,
    remove: queue.remove,
    clear: queue.clear,
  }
})
