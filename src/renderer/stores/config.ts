import { defineStore } from 'pinia'
import { ref, watch, toRaw } from 'vue'
import type { Topic, LLMConfig, OutputConfig, ZoteroConfig, Category } from '../types/config'
import { useToastStore } from './toast'
import {
  listTopics, saveTopic as apiSaveTopic, deleteTopic as apiDeleteTopic,
  getConfig, updateConfig,
  listCategories, saveCategory as apiSaveCategory, deleteCategory as apiDeleteCategory,
  rebuildPaperTopics,
} from '../api'

export const useConfigStore = defineStore('config', () => {
  const topics = ref<Topic[]>([])
  const categories = ref<Category[]>([])
  const llmConfig = ref<LLMConfig>({
    api_key: '',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    temperature: 1.0,
  })
  const outputConfig = ref<OutputConfig>({
    output_dir: './output',
    auto_save: true,
  })
  const zoteroConfig = ref<ZoteroConfig>({
    api_key: '',
    user_id: '',
  })
  const theme = ref<'light' | 'dark' | 'system'>('system')

  // Rebuild index (debounced + queued)
  let _rebuildToastId: number | null = null
  let _rebuildTimer: number | null = null
  let _rebuilding = false
  let _rebuildNeeded = false

  async function _doRebuild() {
    _rebuilding = true
    try {
      await rebuildPaperTopics()
    } catch (err) {
      console.error('Failed to rebuild paper topics:', err)
    } finally {
      _rebuilding = false
      // If more changes happened during rebuild, run again
      if (_rebuildNeeded) {
        _rebuildNeeded = false
        _doRebuild()
      } else {
        const toastStore = useToastStore()
        if (_rebuildToastId !== null) {
          toastStore.remove(_rebuildToastId)
          _rebuildToastId = null
        }
        toastStore.show('重建完成', '论文主题索引已更新', 'success')
      }
    }
  }

  async function triggerRebuild() {
    const toastStore = useToastStore()
    if (_rebuildToastId === null) {
      _rebuildToastId = toastStore.show('重建索引', '正在重建论文主题索引...', 'info', undefined, 0)
    }
    if (_rebuilding) {
      // Already rebuilding, just mark that another run is needed
      _rebuildNeeded = true
      return
    }
    // Debounce
    if (_rebuildTimer) clearTimeout(_rebuildTimer)
    _rebuildTimer = window.setTimeout(() => {
      _rebuildTimer = null
      _doRebuild()
    }, 300)
  }

  // Topics (immediate save)
  const addTopic = async (topic: Omit<Topic, 'id'>): Promise<boolean> => {
    const result = await apiSaveTopic({ ...topic, keywords: [...topic.keywords] })
    if (result && 'error' in result) {
      useToastStore().show('保存失败', result.error, 'error')
      return false
    }
    await loadTopics()
    triggerRebuild()
    return true
  }

  const updateTopic = async (id: number, topic: Partial<Topic>): Promise<boolean> => {
    const payload = { id, name: '', keywords: [], enabled: true, ...topic }
    payload.keywords = topic.keywords ? [...topic.keywords] : []
    const result = await apiSaveTopic(payload)
    if (result && 'error' in result) {
      useToastStore().show('保存失败', result.error, 'error')
      return false
    }
    await loadTopics()
    triggerRebuild()
    return true
  }

  const deleteTopic = async (id: number): Promise<void> => {
    await apiDeleteTopic(id)
    await loadTopics()
    triggerRebuild()
  }

  // Categories (immediate save)
  const addCategory = async (name: string): Promise<void> => {
    await apiSaveCategory({ name, enabled: true })
    await loadCategories()
  }

  const updateCategory = async (id: number, data: Partial<Category>): Promise<void> => {
    const cat = categories.value.find(c => c.id === id)
    if (!cat) return
    await apiSaveCategory({ id, name: cat.name, enabled: cat.enabled, ...data })
    await loadCategories()
  }

  const deleteCategory = async (id: number): Promise<void> => {
    await apiDeleteCategory(id)
    await loadCategories()
  }

  // Debounce helper
  function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
    let timer: number | null = null
    return ((...args: any[]) => {
      if (timer) clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        fn(...args)
      }, ms)
    }) as unknown as T
  }

  // Debounced config save (LLM + Zotero + theme)
  const _persistConfig = debounce(async () => {
    try {
      await updateConfig({
        llm: toRaw(llmConfig.value),
        output: toRaw(outputConfig.value),
        zotero: toRaw(zoteroConfig.value),
        theme: theme.value,
      })
    } catch (err) {
      console.error('Failed to persist config:', err)
    }
  }, 300)

  // Initialize
  const loadConfig = async () => {
    try {
      const { llm, output, zotero, theme: savedTheme } = await getConfig()
      llmConfig.value = llm
      outputConfig.value = output
      if (zotero) zoteroConfig.value = zotero
      if (savedTheme) theme.value = savedTheme as 'light' | 'dark' | 'system'
    } catch (err) { console.error('Failed to load config:', err) }
  }

  const loadTopics = async () => {
    try {
      topics.value = await listTopics()
    } catch (err) { console.error('Failed to load topics:', err) }
  }

  const loadCategories = async () => {
    try {
      categories.value = await listCategories()
    } catch (err) { console.error('Failed to load categories:', err) }
  }

  loadTopics()
  loadCategories()
  loadConfig().then(() => {
    // Start auto-save watch only after initial load to avoid saving defaults
    watch(
      [llmConfig, zoteroConfig, theme],
      () => _persistConfig(),
      { deep: true },
    )
  })

  return {
    topics, categories, llmConfig, outputConfig, zoteroConfig, theme,
    addTopic, updateTopic, deleteTopic,
    addCategory, updateCategory, deleteCategory,
    loadTopics, loadCategories, loadConfig,
  }
})
