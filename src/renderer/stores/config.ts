import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import type { Topic, LLMConfig, OutputConfig, ProxyConfig, ZoteroConfig, Category } from '../types/config'
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
  const proxyConfig = ref<ProxyConfig>({
    http: '',
    https: '',
  })
  const zoteroConfig = ref<ZoteroConfig>({
    api_key: '',
    user_id: '',
  })
  const theme = ref<'light' | 'dark' | 'system'>('system')

  // Topics
  const loadTopics = async () => {
    try { topics.value = await listTopics() } catch (err) { console.error('Failed to load topics:', err) }
  }
  const addTopic = async (topic: Omit<Topic, 'id'>) => {
    const newTopic = await apiSaveTopic(topic)
    topics.value.push(newTopic)
    return newTopic
  }
  const updateTopic = async (id: number, topic: Partial<Topic>) => {
    const existing = topics.value.find(t => t.id === id)
    if (!existing) return
    const updated = await apiSaveTopic({ ...existing, ...topic })
    const index = topics.value.findIndex(t => t.id === id)
    if (index !== -1) topics.value[index] = updated
  }
  const deleteTopic = async (id: number) => {
    await apiDeleteTopic(id)
    topics.value = topics.value.filter(t => t.id !== id)
  }

  // Categories
  const loadCategories = async () => {
    try { categories.value = await listCategories() } catch (err) { console.error('Failed to load categories:', err) }
  }
  const addCategory = async (name: string) => {
    const newCat = await apiSaveCategory({ name, enabled: true })
    categories.value.push(newCat)
    return newCat
  }
  const updateCategory = async (id: number, data: Partial<Category>) => {
    const existing = categories.value.find(c => c.id === id)
    if (!existing) return
    const updated = await apiSaveCategory({ ...existing, ...data })
    const index = categories.value.findIndex(c => c.id === id)
    if (index !== -1) categories.value[index] = updated
  }
  const deleteCategory = async (id: number) => {
    await apiDeleteCategory(id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  // Config
  const loadConfig = async () => {
    try {
      const { llm, output, proxy, zotero, theme: savedTheme } = await getConfig()
      llmConfig.value = llm
      outputConfig.value = output
      if (proxy) proxyConfig.value = proxy
      if (zotero) zoteroConfig.value = zotero
      if (savedTheme) theme.value = savedTheme as 'light' | 'dark' | 'system'
    } catch (err) { console.error('Failed to load config:', err) }
  }
  const saveAll = async () => {
    await updateConfig({ llm: toRaw(llmConfig.value), output: toRaw(outputConfig.value), proxy: toRaw(proxyConfig.value), zotero: toRaw(zoteroConfig.value), theme: theme.value })
  }

  // Initialize
  loadTopics()
  loadCategories()
  loadConfig()

  return {
    topics, categories, llmConfig, outputConfig, proxyConfig, zoteroConfig, theme,
    loadTopics, addTopic, updateTopic, deleteTopic,
    loadCategories, addCategory, updateCategory, deleteCategory,
    loadConfig, saveAll,
  }
})
