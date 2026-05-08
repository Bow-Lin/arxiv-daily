import type { PaperWithAnalysis } from '../types/paper'
import type { Topic, LLMConfig, OutputConfig, ProxyConfig, ZoteroConfig, Category } from '../types/config'

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface FetchDate {
  date: string
  display: string
  count: number
}

// Paper API
export const listPapers = async (params: {
  topicId?: number
  search?: string
  fetchDate?: string
  page?: number
  pageSize?: number
}): Promise<PaginatedResult<PaperWithAnalysis>> => {
  return window.api.listPapers({
    topicId: params.topicId,
    search: params.search,
    fetchDate: params.fetchDate,
    page: params.page || 1,
    pageSize: params.pageSize || 20,
  })
}

export const getPaperDetail = async (paperId: string): Promise<PaperWithAnalysis> => {
  return window.api.getPaperDetail(paperId)
}

// Config API
export const listTopics = async (): Promise<Topic[]> => {
  return window.api.listTopics()
}

export const saveTopic = async (topic: {
  id?: number
  name: string
  keywords: string[]
  enabled: boolean
}): Promise<Topic> => {
  return window.api.saveTopic(topic)
}

export const deleteTopic = async (topicId: number): Promise<void> => {
  return window.api.deleteTopic(topicId)
}

export const getConfig = async (): Promise<{ llm: LLMConfig; output: OutputConfig; proxy: ProxyConfig; zotero?: ZoteroConfig }> => {
  return window.api.getConfig()
}

export const updateConfig = async (config: {
  llm: LLMConfig
  output: OutputConfig
  proxy: ProxyConfig
  zotero?: ZoteroConfig
}): Promise<void> => {
  return window.api.updateConfig(config)
}

// Fetch dates API
export const listFetchDates = async (): Promise<FetchDate[]> => {
  return window.api.listFetchDates()
}

export interface TopicCount {
  topic_id: number
  name: string
  count: number
}

export const listTopicCounts = async (): Promise<TopicCount[]> => {
  return window.api.listTopicCounts()
}

// Category API
export const listCategories = async (): Promise<Category[]> => {
  return window.api.listCategories()
}

export const saveCategory = async (category: {
  id?: number
  name: string
  enabled: boolean
}): Promise<Category> => {
  return window.api.saveCategory(category)
}

export const deleteCategory = async (categoryId: number): Promise<void> => {
  return window.api.deleteCategory(categoryId)
}

// Fetch API
export interface FailedCategory {
  category: string
  error: string
}

export interface FetchPapersResult {
  success: boolean
  new_count: number
  existing_count: number
  failed_categories: string[]
  failed_details: FailedCategory[]
}

export const fetchPapers = async (categories?: string[]): Promise<FetchPapersResult> => {
  return window.api.fetchPapers(categories)
}

export const fetchPapersThisWeek = async (categories?: string[]): Promise<FetchPapersResult> => {
  return window.api.fetchPapersThisWeek(categories)
}

export interface FetchPapersByDateParams {
  startDate: string
  endDate: string
  categories?: string[]
}

export interface FetchPapersByDateResult {
  success: boolean
  local_count: number
  new_count: number
  total_count: number
  failed_categories: string[]
  failed_details: FailedCategory[]
  error?: string
}

export const fetchPapersByDate = async (params: FetchPapersByDateParams): Promise<FetchPapersByDateResult> => {
  return window.api.fetchPapersByDate(params)
}

// Summary API
export const summarizePaper = async (paperId: string, skipIfAnalyzed = true): Promise<{ success: boolean; summary: string | null; skipped?: boolean }> => {
  return window.api.summarizePaper(paperId, skipIfAnalyzed)
}

export const summarizeAllUnanalyzed = async (): Promise<{ success: boolean; analyzed: number; errors: number; stopped?: boolean }> => {
  return window.api.summarizeAllUnanalyzed()
}

export const stopSummary = async (): Promise<{ success: boolean }> => {
  return window.api.stopSummary()
}

export const getUnanalyzedPaperIds = async (): Promise<{ id: string; title: string }[]> => {
  return window.api.getUnanalyzedPaperIds()
}

export const testLLMConnection = async (): Promise<{ success: boolean; message: string }> => {
  return window.api.testLLMConnection()
}

// Analysis API (full paper)
export const analyzeFullPaper = async (paperId: string): Promise<{ success: boolean; cancelled?: boolean }> => {
  return window.api.analyzeFullPaper(paperId)
}

export const getPaperAnalysis = async (paperId: string): Promise<string | null> => {
  return window.api.getPaperAnalysis(paperId)
}

export const getUnanalyzedAnalysisPapers = async (): Promise<{ id: string; title: string }[]> => {
  return window.api.getUnanalyzedAnalysisPapers()
}

export const stopAnalysis = async (): Promise<{ success: boolean }> => {
  return window.api.stopAnalysis()
}

export const clearData = async (): Promise<{ success: boolean }> => {
  return window.api.clearData()
}

export const clearAnalyses = async (): Promise<{ success: boolean }> => {
  return window.api.clearAnalyses()
}

// Zotero API
export interface ZoteroCollection {
  key: string
  name: string
  numItems: number
}

export const listZoteroCollections = async (): Promise<ZoteroCollection[]> => {
  return window.api.listZoteroCollections()
}

export const exportPaperToZotero = async (paperId: string, collectionKey: string, summaryHtml?: string, analysisHtml?: string): Promise<{ success: boolean; itemKey: string }> => {
  return window.api.exportPaperToZotero(paperId, collectionKey, summaryHtml, analysisHtml)
}
