/**
 * Source & Text Material Repository
 * Reference: CogniQuest_개발명세_v1/03_데이터와처리계약.md
 */

import AsyncStorage from '../app_storage';
import { Source, SourceRevision, SourceChunk, TopicSourceLink, UUID } from '../../contracts/types';
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
  const [sources, revsData, chunksData, linksData] = await Promise.all([
    getSources(),
    AsyncStorage.getItem(STORAGE_KEYS.SOURCE_REVISIONS),
    AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS),
    AsyncStorage.getItem(STORAGE_KEYS.TOPIC_SOURCE_LINKS),
  ]);
  const revisions: SourceRevision[] = revsData ? JSON.parse(revsData) : [];
  const removedRevisionIds = new Set(
    revisions.filter((revision) => revision.sourceId === sourceId).map((revision) => revision.id)
  );
  const chunks: SourceChunk[] = chunksData ? JSON.parse(chunksData) : [];
  const links: TopicSourceLink[] = linksData ? JSON.parse(linksData) : [];

  await AsyncStorage.multiSet([
    [STORAGE_KEYS.SOURCES, JSON.stringify(sources.filter((source) => source.id !== sourceId))],
    [
      STORAGE_KEYS.SOURCE_REVISIONS,
      JSON.stringify(revisions.filter((revision) => revision.sourceId !== sourceId)),
    ],
    [
      STORAGE_KEYS.SOURCE_CHUNKS,
      JSON.stringify(chunks.filter((chunk) => !removedRevisionIds.has(chunk.revisionId))),
    ],
    [
      STORAGE_KEYS.TOPIC_SOURCE_LINKS,
      JSON.stringify(links.filter((link) => link.sourceId !== sourceId)),
    ],
  ]);
}

export async function getTopicSourceLinks(topicId?: UUID): Promise<TopicSourceLink[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.TOPIC_SOURCE_LINKS);
  const links: TopicSourceLink[] = data ? JSON.parse(data) : [];
  return topicId ? links.filter((link) => link.topicId === topicId) : links;
}

export async function linkSourceToTopic(link: TopicSourceLink): Promise<void> {
  const links = await getTopicSourceLinks();
  const next = links.filter((item) => item.topicId !== link.topicId);
  next.push(link);
  await AsyncStorage.setItem(STORAGE_KEYS.TOPIC_SOURCE_LINKS, JSON.stringify(next));
}

export async function getLinkedSourceForTopic(topicId: UUID): Promise<Source | null> {
  const [links, sources] = await Promise.all([getTopicSourceLinks(topicId), getSources()]);
  const link = links[0];
  return link ? sources.find((source) => source.id === link.sourceId) ?? null : null;
}

export async function getSourceChunks(revisionId?: UUID): Promise<SourceChunk[]> {
  const chunksData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_CHUNKS);
  const existingChunks: SourceChunk[] = chunksData ? JSON.parse(chunksData) : [];
  return revisionId ? existingChunks.filter((c) => c.revisionId === revisionId) : existingChunks;
}

export async function getSourceTextForSource(sourceId: UUID): Promise<string> {
  const revsData = await AsyncStorage.getItem(STORAGE_KEYS.SOURCE_REVISIONS);
  const revisions: SourceRevision[] = revsData ? JSON.parse(revsData) : [];
  const revisionIds = new Set(
    revisions.filter((revision) => revision.sourceId === sourceId).map((revision) => revision.id)
  );
  const chunks = await getSourceChunks();
  return chunks
    .filter((chunk) => revisionIds.has(chunk.revisionId))
    .map((chunk) => chunk.rawText)
    .filter((text) => text.trim().length > 0)
    .join('\n\n')
    .slice(0, 4000)
    .trim();
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

    if (topicId) {
      const links = await getTopicSourceLinks(topicId);
      const linkedSourceIds = new Set(links.map((link) => link.sourceId));
      const linkedRevisionIds = new Set(
        revs.filter((revision) => linkedSourceIds.has(revision.sourceId)).map((revision) => revision.id)
      );
      matchedChunks = chunks.filter((chunk) => linkedRevisionIds.has(chunk.revisionId));
    }

    // 과거 버전에서 이름으로 저장된 텍스트 자료만 정확한 과목명 일치로 복구합니다.
    if (matchedChunks.length === 0 && topicName && topicName.trim()) {
      const lowerName = topicName.trim().toLowerCase();
      const matchedSourceIds = new Set(
        sources
          .filter((s) => s.kind !== 'pdf' && s.title.trim().toLowerCase() === lowerName)
          .map((s) => s.id)
      );

      const matchedRevIds = new Set(
        revs
          .filter((r) => matchedSourceIds.has(r.sourceId) || r.provenance.toLowerCase().includes(lowerName))
          .map((r) => r.id)
      );

      matchedChunks = chunks.filter((c) => matchedRevIds.has(c.revisionId));
    }

    const combined = matchedChunks
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
