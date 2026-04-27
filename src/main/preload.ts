import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Paper
  listPapers: (params: unknown) => ipcRenderer.invoke('list-papers', params),
  getPaperDetail: (id: string) => ipcRenderer.invoke('get-paper-detail', id),
  listFetchDates: () => ipcRenderer.invoke('list-fetch-dates'),
  listTopicCounts: () => ipcRenderer.invoke('list-topic-counts'),

  // Config
  listTopics: () => ipcRenderer.invoke('list-topics'),
  saveTopic: (topic: unknown) => ipcRenderer.invoke('save-topic', topic),
  deleteTopic: (id: number) => ipcRenderer.invoke('delete-topic', id),
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config: unknown) => ipcRenderer.invoke('update-config', config),
  listCategories: () => ipcRenderer.invoke('list-categories'),
  saveCategory: (category: unknown) => ipcRenderer.invoke('save-category', category),
  deleteCategory: (id: number) => ipcRenderer.invoke('delete-category', id),
  clearData: () => ipcRenderer.invoke('clear-data'),
  clearAnalyses: () => ipcRenderer.invoke('clear-analyses'),

  // Fetch
  fetchPapers: (categories?: string[]) => ipcRenderer.invoke('fetch-papers', categories),
  fetchPapersThisWeek: (categories?: string[]) => ipcRenderer.invoke('fetch-papers-this-week', categories),
  fetchPapersByDate: (params: unknown) => ipcRenderer.invoke('fetch-papers-by-date', params),

  // Summary
  summarizePaper: (id: string, skipIfAnalyzed?: boolean) => ipcRenderer.invoke('summarize-paper', id, skipIfAnalyzed),
  summarizeAllUnanalyzed: () => ipcRenderer.invoke('summarize-all-unanalyzed'),
  stopSummary: () => ipcRenderer.invoke('stop-summary'),
  getUnanalyzedPaperIds: () => ipcRenderer.invoke('get-unanalyzed-paper-ids'),
  testLLMConnection: () => ipcRenderer.invoke('test-llm-connection'),

  // Analysis (full paper)
  analyzeFullPaper: (id: string) => ipcRenderer.invoke('analyze-full-paper', id),
  getPaperAnalysis: (id: string) => ipcRenderer.invoke('get-paper-analysis', id),
  getUnanalyzedAnalysisPapers: () => ipcRenderer.invoke('get-unanalyzed-analysis-papers'),
  stopAnalysis: () => ipcRenderer.invoke('stop-analysis'),

  // Dialog
  openDirectory: () => ipcRenderer.invoke('open-directory'),

  // Events
  onSummaryProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data);
    };
    ipcRenderer.on('summary-progress', handler);
    return () => ipcRenderer.removeListener('summary-progress', handler);
  },
  onAnalysisProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data);
    };
    ipcRenderer.on('analysis-progress', handler);
    return () => ipcRenderer.removeListener('analysis-progress', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
