import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useProgressStore = defineStore('progress', () => {
  const isFetching = ref(false)
  const isAnalyzing = ref(false)

  const progressPhase = ref('')
  const progressCurrent = ref(0)
  const progressTotal = ref(0)
  const currentPaper = ref('')
  const lastError = ref('')

  const showProgress = computed(() => isFetching.value || isAnalyzing.value)

  const progressPercent = computed(() => {
    if (progressTotal.value === 0) return 0
    return Math.round((progressCurrent.value / progressTotal.value) * 100)
  })

  const progressCounter = computed(() => {
    if (progressTotal.value === 0) return ''
    return `${progressCurrent.value} / ${progressTotal.value}`
  })

  function reset() {
    isFetching.value = false
    isAnalyzing.value = false
    progressPhase.value = ''
    currentPaper.value = ''
    lastError.value = ''
  }

  return {
    isFetching, isAnalyzing,
    progressPhase, progressCurrent, progressTotal, currentPaper, lastError,
    showProgress, progressPercent, progressCounter,
    reset,
  }
})
