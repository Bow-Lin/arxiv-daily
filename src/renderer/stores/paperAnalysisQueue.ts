import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPaperDetail } from '../api'
import { usePapersStore } from './papers'
import { useToastStore } from './toast'
import { truncate, extractErrorMessage } from '../utils/format'
import { useDownloadQueueStore } from './downloadQueue'

export interface QueueItem {
  id: string
  title: string
}

export const useAnalysisQueueStore = defineStore('analysisQueue', () => {
  const queue = ref<QueueItem[]>([])
  const currentPaperId = ref<string | null>(null)
  const isRunning = ref(false)
  const stopRequested = ref(false)
  const completedCount = ref(0)
  const errorCount = ref(0)
  const initialTotal = ref(0)
  const progressPhase = ref('')
  const currentPaperTitle = ref('')

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
      processQueue().catch(err => console.error('[AnalysisQueue] Unhandled error:', err))
    }
    return added
  }

  function requestStop(): void {
    stopRequested.value = true
    window.api.stopAnalysis()
  }

  function cancelCurrent(): void {
    window.api.stopAnalysis()
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
    progressPhase.value = ''

    const papersStore = usePapersStore()
    const downloadStore = useDownloadQueueStore()

    const offProgress = window.api.onAnalysisProgress((phase: string) => {
      progressPhase.value = phase
    })

    try {
      while (queue.value.length > 0 && !stopRequested.value) {
        const [item, ...rest] = queue.value
        queue.value = rest
        currentPaperId.value = item.id
        currentPaperTitle.value = item.title

        try {
          await downloadStore.waitForDownload(item.id)
          const result = await window.api.analyzeFullPaper(item.id)

          if (result.cancelled) {
            if (!stopRequested.value) {
              useToastStore().show('已取消', truncate(item.title), 'info')
            }
            continue
          }

          completedCount.value++
          useToastStore().show('分析完成', truncate(item.title), 'success')

          try {
            const updated = await getPaperDetail(item.id)
            const idx = papersStore.papers.findIndex(p => p.id === item.id)
            if (idx !== -1) {
              papersStore.papers.splice(idx, 1, updated)
            } else if (papersStore.selectedPaperId === item.id) {
              papersStore.selectPaper(item.id)
            }
          } catch {
            // Non-fatal
          }
        } catch (err) {
          errorCount.value++
          const msg = extractErrorMessage(err)
          useToastStore().show('分析失败', truncate(item.title), 'error', msg)
          console.error(`[AnalysisQueue] Error for paper ${item.id}: ${msg}`)
        }

        progressPhase.value = ''
      }

    } finally {
      offProgress()
      currentPaperId.value = null
      currentPaperTitle.value = ''
      isRunning.value = false
      progressPhase.value = ''
    }
  }

  return {
    queue,
    currentPaperId,
    currentPaperTitle,
    isRunning,
    completedCount,
    errorCount,
    initialTotal,
    progressPhase,
    isInQueue,
    enqueue,
    requestStop,
    cancelCurrent,
    remove,
    clear,
  }
})
