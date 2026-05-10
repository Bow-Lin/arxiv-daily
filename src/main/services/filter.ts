export interface Topic {
  id: number;
  name: string;
  keywords: string[];
  enabled: boolean;
}

/**
 * Check if text matches any keyword (case-insensitive).
 */
export function matchesKeywords(text: string, keywords: string[]): boolean {
  const textLower = text.toLowerCase();
  return keywords.some(kw => textLower.includes(kw.toLowerCase()));
}

/**
 * Filter papers by topic keywords. Returns matching topic IDs.
 */
export function filterPaperTopics(title: string, abstractText: string, topics: Topic[]): number[] {
  const text = `${title} ${abstractText}`;
  return topics
    .filter(topic => matchesKeywords(text, topic.keywords))
    .map(topic => topic.id);
}
