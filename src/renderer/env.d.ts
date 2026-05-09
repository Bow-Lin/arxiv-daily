/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Topic {
  id: number
  name: string
  keywords: string[]
  enabled: boolean
}

interface Category {
  id: number
  name: string
  enabled: boolean
}

interface LLMConfig {
  api_key: string
  base_url: string
  model: string
  temperature: number
}

interface OutputConfig {
  output_dir: string
  auto_save: boolean
}

interface ZoteroConfig {
  api_key: string
  user_id: string
}

interface PaperWithAnalysis {
  id: string
  title: string
  authors: string[]
  abstract_text: string
  url: string
  pdf_url: string
  published_date: string
  updated_date: string
  categories: string[]
  fetched_at: string
  relevance_topics?: string[] | null
  summary?: string | null
  analysis?: string | null
}

interface ElectronAPI {
  // Paper
  listPapers: (params: {
    topicId?: number
    search?: string
    fetchDate?: string
    page?: number
    pageSize?: number
  }) => Promise<{ items: PaperWithAnalysis[]; total: number; page: number; page_size: number }>
  getPaperDetail: (paperId: string) => Promise<PaperWithAnalysis>
  listFetchDates: () => Promise<{ date: string; display: string; count: number }[]>
  listTopicCounts: () => Promise<{ topic_id: number; name: string; count: number }[]>

  // Config
  listTopics: () => Promise<Topic[]>
  saveTopic: (topic: { id?: number; name: string; keywords: string[]; enabled: boolean }) => Promise<Topic | { error: string }>
  deleteTopic: (topicId: number) => Promise<void>
  rebuildPaperTopics: () => Promise<{ success: boolean; count: number }>
  getConfig: () => Promise<{ llm: LLMConfig; output: OutputConfig; zotero?: ZoteroConfig; theme?: string }>
  updateConfig: (config: { llm: LLMConfig; output: OutputConfig; zotero?: ZoteroConfig; theme?: string }) => Promise<void>
  listCategories: () => Promise<Category[]>
  saveCategory: (category: { id?: number; name: string; enabled: boolean }) => Promise<Category>
  deleteCategory: (categoryId: number) => Promise<void>
  clearData: () => Promise<{ success: boolean }>
  clearAnalyses: () => Promise<{ success: boolean }>

  // Fetch
  fetchPapers: (categories?: string[]) => Promise<{
    success: boolean; new_count: number; existing_count: number
    failed_categories: string[]; failed_details: { category: string; error: string }[]
  }>
  fetchPapersThisWeek: (categories?: string[]) => Promise<{
    success: boolean; new_count: number; existing_count: number
    failed_categories: string[]; failed_details: { category: string; error: string }[]
  }>
  fetchPapersByDate: (params: { startDate: string; endDate: string; categories?: string[] }) => Promise<{
    success: boolean; local_count: number; new_count: number; total_count: number
    failed_categories: string[]; failed_details: { category: string; error: string }[]
    error?: string
  }>

  // Summary
  summarizePaper: (paperId: string, skipIfAnalyzed?: boolean) => Promise<{ success: boolean; summary: string | null; skipped?: boolean; cancelled?: boolean }>
  summarizeAllUnanalyzed: () => Promise<{ success: boolean; analyzed?: number; errors?: number; stopped?: boolean; message?: string }>
  stopSummary: () => Promise<{ success: boolean }>
  getUnanalyzedPaperIds: () => Promise<{ id: string; title: string }[]>
  testLLMConnection: () => Promise<{ success: boolean; message: string }>
  testZoteroConnection: () => Promise<{ success: boolean; message: string }>

  // Analysis (full paper)
  analyzeFullPaper: (id: string) => Promise<{ success: boolean; cancelled?: boolean }>
  getPaperAnalysis: (id: string) => Promise<string | null>
  getUnanalyzedAnalysisPapers: () => Promise<{ id: string; title: string }[]>
  stopAnalysis: () => Promise<{ success: boolean }>

  // PDF download
  downloadPdf: (id: string) => Promise<string>
  openPdf: (id: string) => Promise<void>
  isPdfCached: (id: string) => Promise<boolean>
  deletePdf: (id: string) => Promise<void>
  deleteSummary: (id: string) => Promise<void>
  deleteAnalysis: (id: string) => Promise<void>
  onPdfDownloadProgress: (callback: (data: { paperId: string; loaded: number; total?: number }) => void) => () => void

  // Zotero
  listZoteroCollections: () => Promise<{ key: string; name: string; numItems: number }[]>
  exportPaperToZotero: (paperId: string, collectionKey: string, summaryHtml?: string, analysisHtml?: string) => Promise<{ success: boolean; itemKey: string }>

  // Dialog
  openDirectory: () => Promise<string | undefined>

  // Events
  onSummaryProgress: (callback: (data: any) => void) => () => void
  onAnalysisProgress: (callback: (data: any) => void) => () => void
}

interface Window {
  api: ElectronAPI
}
