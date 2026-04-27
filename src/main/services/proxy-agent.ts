import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { ProxyConfig } from '../commands/config';

export type { ProxyConfig };

function getProxyUrl(config: ProxyConfig): string | undefined {
  return config.https || config.http || undefined;
}

/**
 * A fetch-like function that supports HTTP/HTTPS proxy.
 * Falls back to native fetch when no proxy is configured.
 */
export async function proxyFetch(
  url: string,
  options: {
    signal?: AbortSignal;
    headers?: Record<string, string>;
  } = {},
  proxyConfig?: ProxyConfig,
): Promise<{ body: Buffer; statusCode: number }> {
  const proxyUrl = getProxyUrl(proxyConfig || { http: '', https: '' });

  if (!proxyUrl) {
    // No proxy — use native fetch
    const response = await fetch(url, {
      signal: options.signal,
      headers: options.headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return { body: Buffer.from(arrayBuffer), statusCode: response.status };
  }

  // With proxy — use http/https modules
  return new Promise((resolve, reject) => {
    const agent = new HttpsProxyAgent(proxyUrl);
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(url, {
      agent: agent as any,
      headers: {
        'User-Agent': 'ArxivDailyGUI/1.0',
        ...options.headers,
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({ body: Buffer.concat(chunks), statusCode: res.statusCode || 200 });
      });
      res.on('error', reject);
    });

    req.on('error', reject);

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        req.destroy(new DOMException('Aborted', 'AbortError'));
      });
    }

    req.end();
  });
}
