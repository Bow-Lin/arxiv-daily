/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  listPapers: (params: any) => Promise<any>
  getPaperDetail: (paperId: string) => Promise<any>
  listFetchDates: () => Promise<any[]>
  listTopicCounts: () => Promise<any[]>
  listTopics: () => Promise<any[]>
  saveTopic: (topic: any) => Promise<any>
  deleteTopic: (topicId: number) => Promise<void>
  getConfig: () => Promise<any>
  updateConfig: (config: any) => Promise<void>
  listCategories: () => Promise<any[]>
  saveCategory: (category: any) => Promise<any>
  deleteCategory: (categoryId: number) => Promise<void>
  clearData: () => Promise<any>
  clearAnalyses: () => Promise<any>
  fetchPapers: (categories?: string[]) => Promise<any>
  fetchPapersThisWeek: (categories?: string[]) => Promise<any>
  fetchPapersByDate: (params: { startDate: string; endDate: string; categories?: string[] }) => Promise<any>
  summarizePaper: (paperId: string, skipIfAnalyzed?: boolean) => Promise<any & { cancelled?: boolean }>
  summarizeAllUnanalyzed: () => Promise<any>
  stopSummary: () => Promise<any>
  getUnanalyzedPaperIds: () => Promise<{ id: string; title: string }[]>
  testLLMConnection: () => Promise<any>
  analyzeFullPaper: (id: string) => Promise<any & { cancelled?: boolean }>
  getPaperAnalysis: (id: string) => Promise<string | null>
  getUnanalyzedAnalysisPapers: () => Promise<{ id: string; title: string }[]>
  stopAnalysis: () => Promise<{ success: boolean }>
  openDirectory: () => Promise<string | undefined>
  onSummaryProgress: (callback: (data: any) => void) => () => void
  onAnalysisProgress: (callback: (data: any) => void) => () => void
}

interface Window {
  api: ElectronAPI
}
