import { ref } from 'vue'
import { useToastStore } from './toast'
import { truncate, extractErrorMessage } from '../utils/format'

export interface QueueItem {
  id: string
  title: string
}

export interface ProcessingQueueOptions {
  name: string
  processItem: (item: QueueItem) => Promise<{ cancelled?: boolean } | void>
  stopApi: () => Promise<{ success: boolean }>
  onCompleteAll?: () => Promise<void>
}

export function createProcessingQueue({ name, processItem, stopApi, onCompleteAll }: ProcessingQueueOptions) {
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
      processQueue().catch(err => console.error(`[${name}] Unhandled error:`, err))
    }
    return added
  }

  function requestStop(): void {
    stopRequested.value = true
    stopApi()
  }

  function cancelCurrent(): void {
    stopApi()
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
      useToastStore().show('已取消', `已取消 ${count} 篇待处理论文`, 'info')
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

    try {
      while (queue.value.length > 0 && !stopRequested.value) {
        const [item, ...rest] = queue.value
        queue.value = rest
        currentPaperId.value = item.id
        currentPaperTitle.value = item.title

        try {
          const result = await processItem(item)

          if (result?.cancelled) {
            if (!stopRequested.value) {
              useToastStore().show('已取消', truncate(item.title), 'info')
            }
            continue
          }

          completedCount.value++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (stopRequested.value || msg.includes('abort') || msg.includes('cancel')) {
            if (!stopRequested.value) {
              useToastStore().show('已取消', truncate(item.title), 'info')
            }
            continue
          }
          errorCount.value++
          useToastStore().show('失败', truncate(item.title), 'error', extractErrorMessage(err))
          console.error(`[${name}] Error for paper ${item.id}: ${msg}`)
        }
      }

      if (onCompleteAll) {
        await onCompleteAll()
      }
    } finally {
      currentPaperId.value = null
      currentPaperTitle.value = ''
      isRunning.value = false
    }
  }

  return {
    queue,
    currentPaperId,
    currentPaperTitle,
    isRunning,
    stopRequested,
    completedCount,
    errorCount,
    initialTotal,
    isInQueue,
    enqueue,
    requestStop,
    cancelCurrent,
    remove,
    clear,
    processQueue,
  }
}
