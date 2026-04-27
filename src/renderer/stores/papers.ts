import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PaperWithAnalysis } from '../types/paper'
import type { FetchDate } from '../api'
import { listPapers, summarizePaper as apiSummarizePaper, listFetchDates, getPaperDetail } from '../api'

const PAGE_SIZE = 20

export const usePapersStore = defineStore('papers', () => {
  // State
  const papers = ref<PaperWithAnalysis[]>([])
  const fetchDates = ref<FetchDate[]>([])
  const selectedPaperId = ref<string | null>(null)
  const selectedDate = ref<string | null>(null) // null = "全部"
  const selectedTopicId = ref<number | null>(null) // null = "全部"
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  })

  // Total count across all dates
  const totalCount = computed(() =>
    fetchDates.value.reduce((sum, d) => sum + d.count, 0)
  )

  // Getters
  const selectedPaper = computed(() => {
    if (!selectedPaperId.value) return null
    return papers.value.find(p => p.id === selectedPaperId.value) || null
  })

  // Request serial counter to discard stale responses
  let loadRequestId = 0

  // Actions
  const loadFetchDates = async () => {
    try {
      fetchDates.value = await listFetchDates()
    } catch (err) {
      console.error('Failed to load fetch dates:', err)
    }
  }

  const loadPapers = async (params: {
    search?: string
    page?: number
  } = {}) => {
    const requestId = ++loadRequestId
    // Only show loading state on initial load, not when appending pages
    if (!params.page || params.page <= 1) {
      loading.value = papers.value.length === 0
    }
    error.value = null
    try {
      const result = await listPapers({
        search: params.search,
        fetchDate: selectedDate.value || undefined,
        topicId: selectedTopicId.value || undefined,
        page: params.page || 1,
        pageSize: PAGE_SIZE,
      })

      // Discard stale response if a newer request was started
      if (requestId !== loadRequestId) return

      if (params.page && params.page > 1) {
        papers.value.push(...result.items)
      } else {
        papers.value = result.items
      }

      pagination.value.total = result.total
      pagination.value.page = result.page
    } catch (err) {
      if (requestId !== loadRequestId) return
      error.value = err instanceof Error ? err.message : 'Failed to load papers'
      console.error('Failed to load papers:', err)
    } finally {
      if (requestId === loadRequestId) loading.value = false
    }
  }

  const selectDate = async (date: string | null) => {
    selectedDate.value = date
    selectedTopicId.value = null
    await loadPapers()
  }

  const selectTopic = async (topicId: number | null) => {
    if (selectedTopicId.value === topicId) return
    selectedTopicId.value = topicId
    await loadPapers()
  }

  const selectPaper = async (id: string) => {
    selectedPaperId.value = id

    try {
      const detail = await getPaperDetail(id)
      const idx = papers.value.findIndex(p => p.id === id)
      if (idx !== -1) papers.value.splice(idx, 1, detail)
    } catch (err) {
      console.error('Failed to select paper:', err)
    }
  }

  const clearSelection = () => {
    selectedPaperId.value = null
  }

  const analyzeCurrentPaper = async () => {
    if (!selectedPaperId.value) return
    try {
      await apiSummarizePaper(selectedPaperId.value)
      // Reload just the current paper's data instead of the full list
      const updated = await getPaperDetail(selectedPaperId.value)
      const idx = papers.value.findIndex(p => p.id === selectedPaperId.value)
      if (idx !== -1) papers.value[idx] = updated
    } catch (err) {
      console.error('Failed to analyze paper:', err)
      throw err
    }
  }

  // Initialize
  loadFetchDates()
  loadPapers()

  return {
    papers, fetchDates, selectedDate, selectedTopicId,
    selectedPaperId, selectedPaper,
    loading, error, pagination, totalCount,
    loadFetchDates, loadPapers, selectDate, selectTopic,
    selectPaper, clearSelection, analyzeCurrentPaper,
  }
})
