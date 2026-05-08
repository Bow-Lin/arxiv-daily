import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { ProxyConfig } from '../commands/config';

export type { ProxyConfig };

function getProxyUrl(config: ProxyConfig): string | undefined {
  return config.https || config.http || undefined;
}

export function classifyDirectNetworkError(e: unknown): Error {
  if (e instanceof DOMException && e.name === 'TimeoutError') {
    return new Error('网络请求超时');
  }
  return new Error('网络连接失败');
}

export function classifyProxyNetworkError(e: Error): Error {
  const msg = e.message;
  if (msg.includes('ECONNREFUSED')) {
    return new Error('代理连接被拒绝');
  }
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return new Error('无法解析代理地址');
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET') || msg.includes('socket hang up')) {
    return new Error('代理连接超时或被重置');
  }
  if (msg.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') || msg.includes('certificate')) {
    return new Error('SSL 证书验证失败');
  }
  return new Error(`代理连接失败: ${msg}`);
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
    let response: Response;
    try {
      response = await fetch(url, {
        signal: options.signal,
        headers: options.headers,
      });
    } catch (e) {
      throw classifyDirectNetworkError(e);
    }
    if (!response.ok) {
      const hint = response.status === 429
        ? '请求频率过高 (HTTP 429)'
        : response.status === 503
          ? '服务暂时不可用 (HTTP 503)'
          : `HTTP ${response.status}`;
      throw new Error(hint);
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

    req.on('error', (e: Error) => {
      reject(classifyProxyNetworkError(e));
    });

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        req.destroy(new DOMException('Aborted', 'AbortError'));
      });
    }

    req.end();
  });
}
