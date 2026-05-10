export interface Paper {
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
}

export interface PaperWithAnalysis extends Paper {
  summary?: string | null
  analysis?: string | null
}

export const SUMMARY_FAILED_PREFIX = 'SUMMARY_FAILED:'

export function isAnalyzed(paper: PaperWithAnalysis | ConferencePaper): boolean {
  return !!paper.summary && !paper.summary.startsWith(SUMMARY_FAILED_PREFIX)
}

export function isFailedAnalysis(paper: PaperWithAnalysis | ConferencePaper): boolean {
  return !!paper.summary && paper.summary.startsWith(SUMMARY_FAILED_PREFIX)
}
