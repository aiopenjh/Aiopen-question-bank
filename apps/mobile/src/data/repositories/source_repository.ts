/**
 * Source & Text Material Repository
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

import AsyncStorage from '../app_storage';
import { Source, SourceRevision, SourceChunk, UUID } from '../../contracts/types';
import { STORAGE_KEYS } from '../storage_keys';

export async function getSources(): Promise<Source[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.SOURCES);
  return data ? JSON.parse(data) : [];
}

export async function addSource(
  source: Source,
  revision: SourceRevision,
  chunks: SourceChunk[]
): Promise<void> {
  const sources = await getSources();
  sources.unshift(source);
  await AsyncStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources));

  const revsData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_REVISIONS);
  const revs: SourceRevision[] = revsData ? JSON.parse(revsData) : [];
  revs.unshift(revision);
  await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_REVISIONS, JSON.stringify(revs));

  const chunksData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS);
  const existingChunks: SourceChunk[] = chunksData ? JSON.parse(chunksData) : [];
  existingChunks.push(...chunks);
  await AsyncStorage.setItem(STORAGE_KEYS.SOURCE_CHUNKS, JSON.stringify(existingChunks));
}

export async function deleteSource(sourceId: string): Promise<void> {
  const sources = await getSources();
  const filtered = sources.filter((s) => s.id !== sourceId);
  await AsyncStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(filtered));
}

export async function getSourceChunks(revisionId?: UUID): Promise<SourceChunk[]> {
  const chunksData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS);
  const existingChunks: SourceChunk[] = chunksData ? JSON.parse(chunksData) : [];
  return revisionId ? existingChunks.filter((c) => c.revisionId === revisionId) : existingChunks;
}

export async function getSourceTextForTopic(topicId?: string, topicName?: string): Promise<string> {
  try {
    const sources = await getSources();
    const revsData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_REVISIONS);
    const revs: SourceRevision[] = revsData ? JSON.parse(revsData) : [];
    const chunksData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS);
    const chunks: SourceChunk[] = chunksData ? JSON.parse(chunksData) : [];

    if (chunks.length === 0) return '';

    let matchedChunks: SourceChunk[] = [];

    if (topicName && topicName.trim()) {
      const lowerName = topicName.trim().toLowerCase();
      const matchedSourceIds = new Set(
        sources
          .filter((s) => s.title.toLowerCase().includes(lowerName))
          .map((s) => s.id)
      );

      const matchedRevIds = new Set(
        revs
          .filter((r) => matchedSourceIds.has(r.sourceId) || r.provenance.toLowerCase().includes(lowerName))
          .map((r) => r.id)
      );

      matchedChunks = chunks.filter((c) => matchedRevIds.has(c.revisionId));
    }

    const targetChunks = matchedChunks.length > 0 ? matchedChunks : chunks;

    const combined = targetChunks
      .map((c) => c.rawText)
      .filter((t) => t && t.trim().length > 0)
      .join('\n\n')
      .slice(0, 4000);

    return combined.trim();
  } catch (err) {
    console.warn('교재 텍스트 로드 실패:', err);
    return '';
  }
}
