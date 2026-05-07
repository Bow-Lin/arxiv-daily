import { PDFParse } from 'pdf-parse';
import { mkdir, writeFile, readFile, access, open } from 'fs/promises';
import { join } from 'path';
import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { ProxyConfig } from '../commands/config';

function getPdfDir(dataDir?: string): string {
  return dataDir ? join(dataDir, 'pdfs') : join(process.cwd(), 'pdfs');
}

function sanitizeFileName(url: string): string {
  const rawName = decodeURIComponent(url.split('/').pop() || 'paper.pdf');
  const sanitized = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
}

export function getPdfPath(dataDir: string, url: string): string {
  return join(getPdfDir(dataDir), sanitizeFileName(url));
}

async function downloadStreaming(
  url: string,
  filePath: string,
  signal?: AbortSignal,
  proxyConfig?: ProxyConfig,
  onProgress?: (loaded: number, total?: number) => void,
): Promise<void> {
  const proxyUrl = proxyConfig?.https || proxyConfig?.http;

  if (!proxyUrl) {
    // No proxy — native fetch with ReadableStream
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const total = parseInt(response.headers.get('content-length') || '', 10) || undefined;
    const reader = response.body!.getReader();
    const file = await open(filePath, 'w');
    let loaded = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await file.write(value);
        loaded += value.length;
        onProgress?.(loaded, total);
      }
    } finally {
      await file.close();
    }
  } else {
    // With proxy — http/https modules
    const agent = new HttpsProxyAgent(proxyUrl);
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const file = await open(filePath, 'w');
    let loaded = 0;
    let total: number | undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        const req = lib.request(url, {
          agent: agent as any,
          headers: { 'User-Agent': 'ArxivDailyGUI/1.0' },
        }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // Follow redirect
            downloadStreaming(res.headers.location, filePath, signal, proxyConfig, onProgress)
              .then(resolve).catch(reject);
            return;
          }
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const len = res.headers['content-length'];
          total = len ? parseInt(len, 10) : undefined;
          res.on('data', async (chunk: Buffer) => {
            await file.write(chunk);
            loaded += chunk.length;
            onProgress?.(loaded, total);
          });
          res.on('end', resolve);
          res.on('error', reject);
        });

        req.on('error', reject);
        if (signal) {
          signal.addEventListener('abort', () => {
            req.destroy(new DOMException('Aborted', 'AbortError'));
          });
        }
        req.end();
      });
    } finally {
      await file.close();
    }
  }
}

/**
 * Download a PDF from URL to local cache if not already present.
 * Returns the local file path.
 */
export async function ensurePdfDownloaded(
  url: string,
  signal?: AbortSignal,
  dataDir?: string,
  proxyConfig?: ProxyConfig,
  onProgress?: (loaded: number, total?: number) => void,
): Promise<string> {
  const pdfDir = getPdfDir(dataDir);
  const fileName = sanitizeFileName(url);
  const filePath = join(pdfDir, fileName);

  // Check if already cached
  try {
    await access(filePath);
    return filePath;
  } catch {
    // Not cached, proceed to download
  }

  await mkdir(pdfDir, { recursive: true });
  await downloadStreaming(url, filePath, signal, proxyConfig, onProgress);

  return filePath;
}

/**
 * Download a PDF (if not cached) and extract its text content.
 */
export async function extractTextFromUrl(
  url: string,
  signal?: AbortSignal,
  dataDir?: string,
  proxyConfig?: ProxyConfig,
  onProgress?: (phase: string) => void,
): Promise<string> {
  onProgress?.('下载中');
  const filePath = await ensurePdfDownloaded(url, signal, dataDir, proxyConfig);
  onProgress?.('解析中');

  const data = await readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(data) } as any);
  const result = await parser.getText();
  await parser.destroy();
  return result.text || '';
}
