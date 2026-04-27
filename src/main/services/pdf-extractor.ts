import { PDFParse } from 'pdf-parse';
import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { proxyFetch } from './proxy-agent';
import type { ProxyConfig } from '../commands/config';

/**
 * Download a PDF from a URL to a local file and extract its text content.
 * Reports progress via onProgress callback.
 */
export async function extractTextFromUrl(
  url: string,
  signal?: AbortSignal,
  dataDir?: string,
  proxyConfig?: ProxyConfig,
  onProgress?: (phase: string) => void,
): Promise<string> {
  // Step 1: Download
  onProgress?.('下载中');
  const { body } = await proxyFetch(url, { signal }, proxyConfig);

  // Save to local file
  const pdfDir = dataDir ? join(dataDir, 'pdfs') : join(process.cwd(), 'pdfs');
  await mkdir(pdfDir, { recursive: true });
  const rawName = decodeURIComponent(url.split('/').pop() || 'paper.pdf');
  const sanitized = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = sanitized.endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
  const filePath = join(pdfDir, fileName);
  await writeFile(filePath, body);

  // Step 2: Parse
  onProgress?.('解析中');
  try {
    const data = await readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(data) } as any);
    const result = await parser.getText();
    await parser.destroy();
    return result.text || '';
  } finally {
    try { await unlink(filePath); } catch { /* ignore */ }
  }
}
