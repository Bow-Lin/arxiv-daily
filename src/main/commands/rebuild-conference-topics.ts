import type { Database as SqlJsDatabase } from 'sql.js';
import { filterPaperTopics } from '../services/filter';
import type { Topic } from '../services/filter';

/**
 * Rebuild conference papers' topic associations in paper_topics table.
 */
export function rebuildConferencePaperTopics(
  conferenceDb: SqlJsDatabase,
  paperTopicsDb: SqlJsDatabase,
): number {
  // Load enabled topics
  const topicRows = paperTopicsDb.exec('SELECT id, name, keywords, enabled FROM topics WHERE enabled = TRUE');
  const topics: Topic[] = topicRows.length > 0
    ? topicRows[0].values.map(row => ({
      id: row[0] as number,
      name: row[1] as string,
      keywords: JSON.parse(row[2] as string),
      enabled: Boolean(row[3]),
    }))
    : [];

  // Load all conference papers
  const paperRows = conferenceDb.exec('SELECT id, title, abstract FROM papers');
  if (paperRows.length === 0) return 0;

  const count = paperRows[0].values.length;

  // Clear existing associations
  paperTopicsDb.run('DELETE FROM conference_paper_topics');

  // Rebuild
  paperTopicsDb.run('BEGIN TRANSACTION');
  for (const row of paperRows[0].values) {
    const paperId = row[0] as string;
    const title = row[1] as string;
    const abstract = row[2] as string;
    const matchedTopicIds = filterPaperTopics(title, abstract, topics);
    for (const topicId of matchedTopicIds) {
      paperTopicsDb.run('INSERT OR IGNORE INTO conference_paper_topics (paper_id, topic_id) VALUES (?, ?)', [paperId, topicId]);
    }
  }
  paperTopicsDb.run('COMMIT');

  return count;
}

/**
 * Update associations for a single topic (add/edit) in conference papers.
 */
export function updateConferenceTopicAssociations(
  conferenceDb: SqlJsDatabase,
  paperTopicsDb: SqlJsDatabase,
  topicId: number,
): number {
  const topicRows = paperTopicsDb.exec('SELECT id, name, keywords, enabled FROM topics WHERE id = ?', [topicId]);
  if (topicRows.length === 0 || !topicRows[0].values.length) return 0;

  const topic: Topic = {
    id: topicRows[0].values[0][0] as number,
    name: topicRows[0].values[0][1] as string,
    keywords: JSON.parse(topicRows[0].values[0][2] as string),
    enabled: Boolean(topicRows[0].values[0][3]),
  };

  if (!topic.enabled) {
    paperTopicsDb.run('DELETE FROM conference_paper_topics WHERE topic_id = ?', [topicId]);
    return 0;
  }

  paperTopicsDb.run('DELETE FROM conference_paper_topics WHERE topic_id = ?', [topicId]);

  const paperRows = conferenceDb.exec('SELECT id, title, abstract FROM papers');
  if (paperRows.length === 0) return 0;

  let count = 0;
  paperTopicsDb.run('BEGIN TRANSACTION');
  for (const row of paperRows[0].values) {
    const paperId = row[0] as string;
    const title = row[1] as string;
    const abstract = row[2] as string;
    const matchedTopicIds = filterPaperTopics(title, abstract, [topic]);
    if (matchedTopicIds.length > 0) {
      paperTopicsDb.run('INSERT OR IGNORE INTO conference_paper_topics (paper_id, topic_id) VALUES (?, ?)', [paperId, topicId]);
      count++;
    }
  }
  paperTopicsDb.run('COMMIT');

  return count;
}

/**
 * Remove all conference associations for a deleted topic.
 */
export function deleteConferenceTopicAssociations(
  paperTopicsDb: SqlJsDatabase,
  topicId: number,
): void {
  paperTopicsDb.run('DELETE FROM conference_paper_topics WHERE topic_id = ?', [topicId]);
}
