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
  rebuildPaperTopics: () => ipcRenderer.invoke('rebuild-paper-topics'),
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
  testZoteroConnection: () => ipcRenderer.invoke('test-zotero-connection'),

  // PDF download
  downloadPdf: (id: string) => ipcRenderer.invoke('download-pdf', id),
  openPdf: (id: string) => ipcRenderer.invoke('open-pdf', id),
  isPdfCached: (id: string) => ipcRenderer.invoke('is-pdf-cached', id),
  deletePdf: (id: string) => ipcRenderer.invoke('delete-pdf', id),
  deleteSummary: (id: string) => ipcRenderer.invoke('delete-summary', id),
  deleteAnalysis: (id: string) => ipcRenderer.invoke('delete-analysis', id),
  onPdfDownloadProgress: (callback: (data: { paperId: string; loaded: number; total?: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { paperId: string; loaded: number; total?: number }) => {
      callback(data);
    };
    ipcRenderer.on('pdf-download-progress', handler);
    return () => ipcRenderer.removeListener('pdf-download-progress', handler);
  },

  // Zotero
  listZoteroCollections: () => ipcRenderer.invoke('list-zotero-collections'),
  exportPaperToZotero: (paperId: string, collectionKey: string, summaryHtml?: string, analysisHtml?: string) => ipcRenderer.invoke('export-paper-to-zotero', paperId, collectionKey, summaryHtml, analysisHtml),

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

  // Conference
  listConferences: () => ipcRenderer.invoke('conference:list-conferences'),
  listConferencePapers: (params: unknown) => ipcRenderer.invoke('conference:list-papers', params),
  getConferencePaperDetail: (id: string) => ipcRenderer.invoke('conference:get-paper-detail', id),
  listConferenceTracks: (conferenceId: number) => ipcRenderer.invoke('conference:list-tracks', conferenceId),
  conferenceSummarizePaper: (id: string, skipIfAnalyzed?: boolean) => ipcRenderer.invoke('conference:summarize-paper', id, skipIfAnalyzed),
  conferenceStopSummary: () => ipcRenderer.invoke('conference:stop-summary'),
  conferenceGetUnanalyzedIds: () => ipcRenderer.invoke('conference:get-unanalyzed-ids'),
  conferenceAnalyzeFullPaper: (id: string) => ipcRenderer.invoke('conference:analyze-full-paper', id),
  conferenceGetPaperAnalysis: (id: string) => ipcRenderer.invoke('conference:get-paper-analysis', id),
  conferenceStopAnalysis: () => ipcRenderer.invoke('conference:stop-analysis'),
  conferenceDownloadPdf: (id: string) => ipcRenderer.invoke('conference:download-pdf', id),
  conferenceOpenPdf: (id: string) => ipcRenderer.invoke('conference:open-pdf', id),
  conferenceIsPdfCached: (id: string) => ipcRenderer.invoke('conference:is-pdf-cached', id),
  conferenceDeletePdf: (id: string) => ipcRenderer.invoke('conference:delete-pdf', id),
  conferenceDeleteSummary: (id: string) => ipcRenderer.invoke('conference:delete-summary', id),
  conferenceDeleteAnalysis: (id: string) => ipcRenderer.invoke('conference:delete-analysis', id),
  conferenceExportToZotero: (paperId: string, collectionKey: string, summaryHtml?: string, analysisHtml?: string) => ipcRenderer.invoke('conference:export-to-zotero', paperId, collectionKey, summaryHtml, analysisHtml),
};

contextBridge.exposeInMainWorld('api', api);
