const ZOTERO_API_BASE = 'https://api.zotero.org';

export interface ZoteroCollection {
  key: string;
  name: string;
  numItems: number;
}

/**
 * Fetch collections from a Zotero library.
 */
export async function fetchCollections(
  userId: string,
  apiKey: string,
): Promise<ZoteroCollection[]> {
  const url = `${ZOTERO_API_BASE}/users/${userId}/collections?limit=100`;
  const res = await fetch(url, {
    headers: { 'Zotero-API-Key': apiKey },
  });
  if (!res.ok) {
    const hint = res.status === 403 ? 'API Key 无权限 (HTTP 403)'
      : res.status === 404 ? '用户不存在 (HTTP 404)'
      : `HTTP ${res.status}`;
    throw new Error(`Zotero ${hint}: ${await res.text().catch(() => '')}`);
  }
  const data = await res.json();
  return (data || []).map((c: any) => ({
    key: c.key,
    name: c.data?.name || '',
    numItems: c.meta?.numItems || 0,
  }));
}

export interface CreateItemPayload {
  itemType: string;
  title: string;
  abstractNote: string;
  date: string;
  DOI: string;
  url: string;
  extra: string;
  repository: string;
  archiveID: string;
  proceedingsTitle?: string;
  conferenceName?: string;
  pages?: string;
  creators: { creatorType: string; firstName: string; lastName: string }[];
  tags: { tag: string }[];
  collections: string[];
}

export interface ChildItemPayload {
  itemType: string;
  parentItem: string;
  linkMode?: string;
  path?: string;
  title?: string;
  contentType?: string;
  note?: string;
  tags?: { tag: string }[];
}

/**
 * Create items in Zotero (main item, or child items).
 */
async function createItems(
  userId: string,
  apiKey: string,
  items: any[],
): Promise<any[]> {
  const url = `${ZOTERO_API_BASE}/users/${userId}/items`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Zotero-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const hint = res.status === 403 ? 'API Key 无权限 (HTTP 403)'
      : res.status === 404 ? '用户不存在 (HTTP 404)'
      : `HTTP ${res.status}`;
    throw new Error(`Zotero ${hint}: ${await res.text().catch(() => '')}`);
  }
  const data = await res.json();
  const successKeys = Object.keys(data.successful || {});
  if (successKeys.length === 0) {
    console.error('[Zotero] API response:', JSON.stringify(data, null, 2));
    const failedKeys = Object.keys(data.failed || {});
    const failedMsg = failedKeys.length > 0 ? JSON.stringify(data.failed) : 'unknown';
    throw new Error(`Zotero 条目创建失败: ${failedMsg}`);
  }
  return successKeys.map(idx => {
    const item = data.success[idx];
    // Zotero API returns just the key string for successful items
    return typeof item === 'string' ? { key: item } : item;
  });
}

/**
 * Create a single item in a Zotero collection.
 */
export async function createItem(
  userId: string,
  apiKey: string,
  collectionKey: string,
  item: CreateItemPayload,
): Promise<string> {
  const results = await createItems(userId, apiKey, [
    { ...item, collections: [collectionKey] },
  ]);
  return results[0].key;
}

/**
 * Create child items (attachments, notes) under a parent item.
 */
export async function createChildItems(
  userId: string,
  apiKey: string,
  children: ChildItemPayload[],
): Promise<void> {
  if (children.length === 0) return;
  await createItems(userId, apiKey, children);
}
