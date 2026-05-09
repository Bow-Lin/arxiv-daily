let analysisAbortController: AbortController | null = null;

export function setAnalysisAbortController(controller: AbortController | null): void {
  analysisAbortController = controller;
}

export function stopAnalysis(): { success: boolean } {
  if (analysisAbortController) {
    analysisAbortController.abort();
    analysisAbortController = null;
  }
  return { success: true };
}
