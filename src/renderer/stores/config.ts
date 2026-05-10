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

  // Rebuild index
  let _rebuilding = false

  async function triggerRebuild() {
    if (_rebuilding) return
    _rebuilding = true
    const toastStore = useToastStore()
    const toastId = toastStore.show('重建索引', '正在重建论文主题索引...', 'info', undefined, 0)
    try {
      await rebuildPaperTopics()
      toastStore.remove(toastId)
      toastStore.show('重建完成', '论文主题索引已更新', 'success')
    } catch (err) {
      toastStore.remove(toastId)
      toastStore.show('重建失败', err instanceof Error ? err.message : String(err), 'error')
    } finally {
      _rebuilding = false
    }
  }

  // Topics (immediate save)
  const addTopic = async (topic: Omit<Topic, 'id'>): Promise<boolean> => {
    const result = await apiSaveTopic({ ...topic, keywords: [...topic.keywords] })
    if (result && 'error' in result) {
      useToastStore().show('保存失败', result.error, 'error')
      return false
    }
    await loadTopics()
    useToastStore().show('添加成功', `主题"${topic.name}"已添加`, 'success')
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
    useToastStore().show('保存成功', `主题"${topic.name}"已更新`, 'success')
    return true
  }

  const deleteTopic = async (id: number): Promise<void> => {
    const topic = topics.value.find(t => t.id === id)
    await apiDeleteTopic(id)
    await loadTopics()
    useToastStore().show('删除成功', `主题"${topic?.name}"已删除`, 'success')
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
    triggerRebuild,
  }
})
