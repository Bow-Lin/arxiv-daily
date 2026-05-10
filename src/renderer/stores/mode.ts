import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type AppMode = 'arxiv' | 'conference'

const STORAGE_KEY = 'app-mode'

export const useModeStore = defineStore('mode', () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  const mode = ref<AppMode>(saved === 'conference' ? 'conference' : 'arxiv')

  watch(mode, (val) => {
    localStorage.setItem(STORAGE_KEY, val)
  })

  const isConference = computed(() => mode.value === 'conference')

  let initialized = false

  async function toggleMode() {
    mode.value = mode.value === 'arxiv' ? 'conference' : 'arxiv'
    if (mode.value === 'conference' && !initialized) {
      const { useConferencePapersStore } = await import('./conference-papers')
      await useConferencePapersStore().loadConferences()
      await useConferencePapersStore().loadPapers()
      initialized = true
    }
  }

  async function initIfNeeded() {
    if (mode.value === 'conference' && !initialized) {
      const { useConferencePapersStore } = await import('./conference-papers')
      await useConferencePapersStore().loadConferences()
      await useConferencePapersStore().loadPapers()
      initialized = true
    }
  }

  // Auto-init on store creation
  initIfNeeded()

  return { mode, isConference, toggleMode }
})
