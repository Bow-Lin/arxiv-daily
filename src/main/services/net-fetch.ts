import { net } from 'electron';

export function classifyDirectNetworkError(e: unknown): Error {
  if (e instanceof DOMException && e.name === 'TimeoutError') {
    return new Error('网络请求超时');
  }
  return new Error('网络连接失败');
}

/**
 * A fetch-like function using electron net.fetch (respects system proxy).
 */
export async function netFetch(
  url: string,
  options: {
    signal?: AbortSignal;
    headers?: Record<string, string>;
  } = {},
): Promise<{ body: Buffer; statusCode: number }> {
  let response: Response;
  try {
    response = await net.fetch(url, {
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
