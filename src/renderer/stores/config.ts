import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import type { Topic, LLMConfig, OutputConfig, ZoteroConfig, Category } from '../types/config'
import {
  listTopics, saveTopic as apiSaveTopic, deleteTopic as apiDeleteTopic,
  getConfig, updateConfig,
  listCategories, saveCategory as apiSaveCategory, deleteCategory as apiDeleteCategory,
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

  // Snapshot of loaded state for change detection
  let _loadedTopicsJson = '[]'
  let _loadedCategoriesJson = '[]'
  let _loadedConfigJson = ''

  const _pendingDeletedTopicIds = new Set<number>()
  let _nextTempId = -1

  // Topics (local-only, persisted on saveAll)
  const addTopic = (topic: Omit<Topic, 'id'>): Topic => {
    const newTopic: Topic = { ...topic, id: _nextTempId-- }
    topics.value.push(newTopic)
    return newTopic
  }
  const updateTopic = (id: number, topic: Partial<Topic>) => {
    const existing = topics.value.find(t => t.id === id)
    if (!existing) return
    Object.assign(existing, topic)
  }
  const deleteTopic = (id: number) => {
    if (id > 0) _pendingDeletedTopicIds.add(id)
    topics.value = topics.value.filter(t => t.id !== id)
  }

  // Categories (local-only, persisted on saveAll)
  const _pendingDeletedCategoryIds = new Set<number>()
  let _nextTempCatId = -1

  const addCategory = (name: string): Category => {
    const newCat: Category = { id: _nextTempCatId--, name, enabled: true }
    categories.value.push(newCat)
    return newCat
  }
  const updateCategory = (id: number, data: Partial<Category>) => {
    const existing = categories.value.find(c => c.id === id)
    if (!existing) return
    Object.assign(existing, data)
  }
  const deleteCategory = (id: number) => {
    if (id > 0) _pendingDeletedCategoryIds.add(id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  // Change detection
  const hasChanges = computed(() => {
    return JSON.stringify(toRaw(topics.value)) !== _loadedTopicsJson
      || JSON.stringify(toRaw(categories.value)) !== _loadedCategoriesJson
      || JSON.stringify({ llm: toRaw(llmConfig.value), output: toRaw(outputConfig.value), zotero: toRaw(zoteroConfig.value), theme: theme.value }) !== _loadedConfigJson
  })

  // Config
  const loadConfig = async () => {
    try {
      const { llm, output, zotero, theme: savedTheme } = await getConfig()
      llmConfig.value = llm
      outputConfig.value = output
      if (zotero) zoteroConfig.value = zotero
      if (savedTheme) theme.value = savedTheme as 'light' | 'dark' | 'system'
    } catch (err) { console.error('Failed to load config:', err) }
  }

  const saveLLM = async () => {
    await updateConfig({ llm: toRaw(llmConfig.value), output: toRaw(outputConfig.value), zotero: toRaw(zoteroConfig.value), theme: theme.value })
  }

  const saveAll = async () => {
    // 1. Persist deleted topics
    for (const id of _pendingDeletedTopicIds) {
      await apiDeleteTopic(id)
    }
    _pendingDeletedTopicIds.clear()

    // 2. Persist topics (new and updated)
    for (let i = 0; i < topics.value.length; i++) {
      const topic = toRaw(topics.value[i])
      if (topic.id < 0) {
        const saved = await apiSaveTopic({ name: topic.name, keywords: [...topic.keywords], enabled: topic.enabled })
        topics.value[i] = saved
      } else {
        await apiSaveTopic({ ...topic, keywords: [...topic.keywords] })
      }
    }

    // 3. Persist deleted categories
    for (const id of _pendingDeletedCategoryIds) {
      await apiDeleteCategory(id)
    }
    _pendingDeletedCategoryIds.clear()

    // 4. Persist categories (new and updated)
    for (let i = 0; i < categories.value.length; i++) {
      const cat = toRaw(categories.value[i])
      if (cat.id < 0) {
        const saved = await apiSaveCategory({ name: cat.name, enabled: cat.enabled })
        categories.value[i] = saved
      } else {
        await apiSaveCategory({ ...cat })
      }
    }

    // 5. Persist config (LLM, Zotero, theme)
    await updateConfig({ llm: toRaw(llmConfig.value), output: toRaw(outputConfig.value), zotero: toRaw(zoteroConfig.value), theme: theme.value })

    // Update snapshots
    _loadedTopicsJson = JSON.stringify(toRaw(topics.value))
    _loadedCategoriesJson = JSON.stringify(toRaw(categories.value))
    _loadedConfigJson = JSON.stringify({ llm: toRaw(llmConfig.value), output: toRaw(outputConfig.value), zotero: toRaw(zoteroConfig.value), theme: theme.value })
  }

  // Initialize
  const loadTopics = async () => {
    try {
      topics.value = await listTopics()
      _loadedTopicsJson = JSON.stringify(toRaw(topics.value))
    } catch (err) { console.error('Failed to load topics:', err) }
  }
  const loadCategories = async () => {
    try {
      categories.value = await listCategories()
      _loadedCategoriesJson = JSON.stringify(toRaw(categories.value))
    } catch (err) { console.error('Failed to load categories:', err) }
  }

  loadTopics()
  loadCategories()
  loadConfig().then(() => {
    _loadedConfigJson = JSON.stringify({ llm: toRaw(llmConfig.value), output: toRaw(outputConfig.value), zotero: toRaw(zoteroConfig.value), theme: theme.value })
  })

  return {
    topics, categories, llmConfig, outputConfig, zoteroConfig, theme,
    addTopic, updateTopic, deleteTopic,
    addCategory, updateCategory, deleteCategory,
    hasChanges, saveLLM, saveAll,
  }
})
