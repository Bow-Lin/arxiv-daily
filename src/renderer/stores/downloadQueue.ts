import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useToastStore } from './toast'
import { truncate, extractErrorMessage } from '../utils/format'

export interface DownloadItem {
  id: string
  title: string
}

export const useDownloadQueueStore = defineStore('downloadQueue', () => {
  const queue = ref<DownloadItem[]>([])
  const currentPaperId = ref<string | null>(null)
  const currentPaperTitle = ref('')
  const currentProgress = ref(0)
  const isRunning = ref(false)

  // paperId -> array of resolve callbacks waiting for download completion
  const waiters = new Map<string, Array<(filePath: string) => void>>()
  // paperId -> filePath (result of successful download)
  const completedPaths = new Map<string, string>()

  function isInQueue(paperId: string): boolean {
    return currentPaperId.value === paperId || queue.value.some(item => item.id === paperId)
  }

  function enqueue(items: DownloadItem[]): number {
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
      processQueue().catch(err => console.error('[DownloadQueue] Unhandled error:', err))
    }
    return added
  }

  function remove(paperId: string): void {
    const item = queue.value.find(i => i.id === paperId)
    if (item) {
      useToastStore().show('已取消', truncate(item.title), 'info')
      queue.value = queue.value.filter(i => i.id !== paperId)
    }
  }

  function clear(): void {
    queue.value = []
  }

  async function waitForDownload(paperId: string): Promise<string> {
    // Already have a completed result
    const completed = completedPaths.get(paperId)
    if (completed) return completed

    // Check if already cached
    const cached = await window.api.isPdfCached(paperId)
    if (cached) return paperId

    // Register as waiter
    return new Promise<string>((resolve) => {
      if (!waiters.has(paperId)) {
        waiters.set(paperId, [])
      }
      waiters.get(paperId)!.push(resolve)

      // If not already in queue, enqueue it
      if (!isInQueue(paperId)) {
        // We need the title — but waitForDownload might not have it
        // The caller (analysis queue) should ensure it's already queued or we add a placeholder
        enqueue([{ id: paperId, title: '' }])
      }
    })
  }

  function resolveWaiters(paperId: string, filePath: string): void {
    const callbacks = waiters.get(paperId)
    if (callbacks) {
      for (const cb of callbacks) {
        cb(filePath)
      }
      waiters.delete(paperId)
    }
    completedPaths.set(paperId, filePath)
  }

  function rejectWaiters(paperId: string): void {
    const callbacks = waiters.get(paperId)
    if (callbacks) {
      for (const cb of callbacks) {
        cb('') // resolve with empty string — analysis will fail naturally
      }
      waiters.delete(paperId)
    }
  }

  async function processQueue(): Promise<void> {
    if (isRunning.value) return
    isRunning.value = true

    try {
      while (queue.value.length > 0) {
        const [item, ...rest] = queue.value
        queue.value = rest
        currentPaperId.value = item.id
        currentPaperTitle.value = item.title
        currentProgress.value = 0

        const offProgress = window.api.onPdfDownloadProgress((data: { paperId: string; loaded: number; total?: number }) => {
          if (data.paperId !== item.id) return
          if (data.total) {
            currentProgress.value = Math.round((data.loaded / data.total) * 100)
          } else {
            currentProgress.value = Math.min(99, Math.round(data.loaded / 1024 / 10))
          }
        })

        try {
          await window.api.downloadPdf(item.id)
          currentProgress.value = 100
          resolveWaiters(item.id, item.id)
        } catch (err) {
          const msg = extractErrorMessage(err)
          useToastStore().show('下载失败', truncate(item.title || item.id), 'error', msg)
          console.error(`[DownloadQueue] Error for paper ${item.id}: ${msg}`)
          rejectWaiters(item.id)
        } finally {
          offProgress()
        }
      }
    } finally {
      currentPaperId.value = null
      currentPaperTitle.value = ''
      currentProgress.value = 0
      isRunning.value = false
      // Cleanup old completed paths
      completedPaths.clear()
    }
  }

  return {
    queue,
    currentPaperId,
    currentPaperTitle,
    currentProgress,
    isRunning,
    isInQueue,
    enqueue,
    remove,
    clear,
    waitForDownload,
  }
})
