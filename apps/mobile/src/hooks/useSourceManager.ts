/**
 * Study material manager.
 * PDF bytes stay in memory only. IndexedDB stores metadata, links and generated learning data.
 */

import { useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
// The bundled ESM build avoids Metro's production-only interop failure in pdf-lib's
// unbundled tslib dependency while keeping PDF work local to the device.
import { PDFDocument } from 'pdf-lib/dist/pdf-lib.esm.js';
import {
  AiDocumentInput,
  Source,
  SourceRevision,
  SourceChunk,
  Topic,
} from '../contracts/types';
import {
  addSource,
  deleteSource,
  generateUUID,
  getCurrentISOTime,
  getSources,
  getTopicSourceLinks,
  linkSourceToTopic,
} from '../data/db';
import { base64ToU8, unzipSync, strFromU8, u8ToBase64 } from '../utils/backupArchive';
import { showAlert } from '../utils/alert';

const LARGE_PDF_PAGE_THRESHOLD = 30;
const RECOMMENDED_PDF_PAGE_BLOCK = 20;

interface PdfMemoryEntry {
  bytes: Uint8Array;
  fingerprint: string;
  fileName: string;
  pageCount: number;
}

const pdfMemoryCache = new Map<string, PdfMemoryEntry>();

async function readPickedBytes(file: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web' && (file as any).file) {
    return new Uint8Array(await (file as any).file.arrayBuffer());
  }
  const base64 = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToU8(base64);
}

async function fingerprintBytes(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const copied = new Uint8Array(bytes.length);
    copied.set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', copied.buffer);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 2166136261;
  const stride = Math.max(1, Math.floor(bytes.length / 4096));
  for (let index = 0; index < bytes.length; index += stride) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }
  return `size-${bytes.length}-fnv-${(hash >>> 0).toString(16)}`;
}

async function pickSingleDocument(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  return result.canceled || !result.assets?.length ? null : result.assets[0];
}

export function useSourceManager(params: {
  topics: Topic[];
  setSources: (sources: Source[]) => void;
}) {
  const { topics, setSources } = params;
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceTopicId, setSourceTopicId] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [sourcePageCount, setSourcePageCount] = useState<number | null>(null);
  const [sourcePageStart, setSourcePageStart] = useState(1);
  const [sourcePageEnd, setSourcePageEnd] = useState(RECOMMENDED_PDF_PAGE_BLOCK);
  const [pendingPdf, setPendingPdf] = useState<PdfMemoryEntry | null>(null);

  function applyLargePdfDefault(pageCount: number): boolean {
    setSourcePageStart(1);
    setSourcePageEnd(Math.min(RECOMMENDED_PDF_PAGE_BLOCK, pageCount));
    if (pageCount <= LARGE_PDF_PAGE_THRESHOLD) return false;

    showAlert(
      'PDF 페이지가 많습니다',
      `선택한 PDF는 총 ${pageCount}페이지입니다.\n\n전체 문서를 한 번에 분석하면 처리 시간이 길어지고 Gemini API 무료 할당량을 초과하거나 429 제한이 발생할 수 있습니다.\n\n필요한 페이지를 지정하거나 여러 구간으로 나누어 문제를 출제하는 것을 권장합니다.`,
      [
        {
          text: '20페이지씩 나눠 출제',
          onPress: () => {
            setSourcePageStart(1);
            setSourcePageEnd(Math.min(RECOMMENDED_PDF_PAGE_BLOCK, pageCount));
          },
        },
        { text: '직접 범위 지정', style: 'cancel' },
        {
          text: '전체 문서로 계속',
          onPress: () => {
            setSourcePageStart(1);
            setSourcePageEnd(pageCount);
          },
        },
      ]
    );
    return true;
  }

  async function handlePickSourceFile() {
    try {
      const file = await pickSingleDocument();
      if (!file) return;
      const fileName = file.name;
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      if (ext === 'hwp' || ext === 'hwpx') {
        showAlert(
          '한글 문서 변환 안내',
          '한글 문서는 바로 읽을 수 없습니다. PDF 또는 텍스트(.txt)로 변환한 뒤 첨부해 주세요.'
        );
        return;
      }

      if (!sourceTitle.trim()) setSourceTitle(fileName.replace(/\.[^/.]+$/, ''));
      setSourceFileName(fileName);

      if (ext === 'pdf') {
        const bytes = await readPickedBytes(file);
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
        const pageCount = pdf.getPageCount();
        const fingerprint = await fingerprintBytes(bytes);
        setPendingPdf({ bytes, fingerprint, fileName, pageCount });
        setSourceText('');
        setSourcePageCount(pageCount);
        const warnedForSize = applyLargePdfDefault(pageCount);
        if (!warnedForSize) {
          showAlert(
            'PDF 불러오기 완료',
            `${fileName}\n총 ${pageCount}페이지를 확인했습니다.\n\nPDF 원본은 저장하지 않으며 선택한 페이지는 목차나 문제를 만들 때만 Gemini에 전달됩니다.`
          );
        }
        return;
      }

      setPendingPdf(null);
      setSourcePageCount(null);
      let extractedText = '';
      if (ext === 'zip') {
        const unzipped = unzipSync(await readPickedBytes(file));
        for (const name of Object.keys(unzipped)) {
          const innerExt = name.split('.').pop()?.toLowerCase();
          if (innerExt === 'txt' || innerExt === 'md' || innerExt === 'json' || innerExt === 'csv') {
            extractedText += `[${name}]\n${strFromU8(unzipped[name])}\n\n`;
          }
        }
        if (!extractedText) throw new Error('ZIP 안에서 읽을 수 있는 텍스트 자료를 찾지 못했습니다.');
      } else if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
        extractedText = Platform.OS === 'web' && (file as any).file
          ? await (file as any).file.text()
          : await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      } else {
        throw new Error('PDF, TXT, MD, CSV, JSON 또는 ZIP 파일만 지원합니다.');
      }

      setSourceText(extractedText);
      showAlert('파일 불러오기 완료', `“${fileName}” 내용을 읽었습니다. 자료 등록을 눌러 저장해 주세요.`);
    } catch (error: any) {
      console.warn('파일 첨부 실패:', error);
      showAlert('파일 불러오기 실패', error?.message || '파일을 읽지 못했습니다.');
    }
  }

  async function handleSaveSource(): Promise<boolean> {
    if (!sourceTitle.trim()) {
      showAlert('알림', '자료 이름을 입력해 주세요.');
      return false;
    }
    if (!pendingPdf && !sourceText.trim()) {
      showAlert('알림', '먼저 읽을 파일을 선택해 주세요.');
      return false;
    }

    const sourceId = generateUUID();
    const revisionId = generateUUID();
    const isPdf = Boolean(pendingPdf);
    const pageStart = isPdf ? Math.max(1, Math.min(sourcePageStart, pendingPdf!.pageCount)) : undefined;
    const pageEnd = isPdf
      ? Math.max(pageStart!, Math.min(sourcePageEnd, pendingPdf!.pageCount))
      : undefined;
    const newSource: Source = {
      id: sourceId,
      ownerId: 'owner-default',
      kind: isPdf ? 'pdf' : 'text',
      title: sourceTitle.trim(),
      fileName: sourceFileName || undefined,
      fileSizeBytes: isPdf ? pendingPdf!.bytes.byteLength : undefined,
      pageCount: isPdf ? pendingPdf!.pageCount : undefined,
      fingerprint: isPdf ? pendingPdf!.fingerprint : undefined,
      selectedPageStart: pageStart,
      selectedPageEnd: pageEnd,
      visibility: 'private',
      allowExternalProcessing: isPdf,
      archivedAt: null,
      createdAt: getCurrentISOTime(),
    };
    const revision: SourceRevision = {
      id: revisionId,
      sourceId,
      hash: isPdf ? pendingPdf!.fingerprint : `text-${Date.now()}`,
      provenance: isPdf
        ? `PDF ${pageStart}~${pageEnd}페이지 선택, 원본 미보관`
        : '사용자 첨부 텍스트 자료',
      originalFileRef: null,
      createdAt: getCurrentISOTime(),
    };
    const chunks: SourceChunk[] = isPdf
      ? []
      : [{
          id: generateUUID(),
          revisionId,
          rawText: sourceText.trim(),
          normalizedText: sourceText.trim().replace(/\s+/g, ' '),
          locator: { kind: 'text', blockIndex: 0 },
          extractionStatus: 'success',
        }];

    await addSource(newSource, revision, chunks);
    if (pendingPdf) pdfMemoryCache.set(sourceId, pendingPdf);
    const targetTopic = topics.find((topic) => topic.id === sourceTopicId);
    if (targetTopic) {
      await linkSourceToTopic({
        topicId: targetTopic.id,
        sourceId,
        pageStart,
        pageEnd,
        lastProcessedPage: pageStart,
        createdAt: getCurrentISOTime(),
      });
    }

    setSources(await getSources());
    showAlert(
      '자료 등록 완료',
      isPdf
        ? `“${newSource.title}”의 제목과 페이지 정보만 저장했습니다. PDF 원본은 저장하지 않았습니다.`
        : `“${newSource.title}” 자료를 저장했습니다.`
    );
    setSourceTitle('');
    setSourceText('');
    setSourceFileName(null);
    setSourcePageCount(null);
    setSourcePageStart(1);
    setSourcePageEnd(RECOMMENDED_PDF_PAGE_BLOCK);
    setPendingPdf(null);
    setSourceTopicId(null);
    return true;
  }

  async function handleReconnectSource(sourceId: string) {
    const source = (await getSources()).find((item) => item.id === sourceId);
    if (!source || source.kind !== 'pdf') return;
    try {
      const file = await pickSingleDocument();
      if (!file) return;
      const bytes = await readPickedBytes(file);
      const fingerprint = await fingerprintBytes(bytes);
      if (source.fingerprint && fingerprint !== source.fingerprint) {
        showAlert('다른 PDF입니다', `처음 등록한 “${source.fileName || source.title}” 파일을 선택해 주세요.`);
        return;
      }
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
      pdfMemoryCache.set(sourceId, { bytes, fingerprint, fileName: file.name, pageCount: pdf.getPageCount() });
      showAlert('원본 PDF 연결 완료', 'PDF는 저장하지 않고 이번 실행 중에만 목차와 문제 출제에 사용합니다.');
    } catch (error: any) {
      showAlert('PDF 연결 실패', error?.message || 'PDF를 다시 읽지 못했습니다.');
    }
  }

  function hasPdfInMemory(sourceId: string): boolean {
    return pdfMemoryCache.has(sourceId);
  }

  async function getDocumentInputForSource(
    sourceId: string,
    pageStart?: number,
    pageEnd?: number
  ): Promise<AiDocumentInput | null> {
    const source = (await getSources()).find((item) => item.id === sourceId);
    if (!source || source.kind !== 'pdf') return null;
    const cached = pdfMemoryCache.get(sourceId);
    if (!cached) return null;

    const start = Math.max(1, Math.min(pageStart ?? source.selectedPageStart ?? 1, cached.pageCount));
    const end = Math.max(start, Math.min(pageEnd ?? source.selectedPageEnd ?? cached.pageCount, cached.pageCount));
    const original = await PDFDocument.load(cached.bytes, { ignoreEncryption: false });
    const sliced = await PDFDocument.create();
    const indexes = Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index);
    const pages = await sliced.copyPages(original, indexes);
    pages.forEach((page) => sliced.addPage(page));
    const bytes = await sliced.save({ useObjectStreams: true });
    if (bytes.byteLength > 48 * 1024 * 1024) {
      throw new Error('선택한 PDF 구간의 용량이 큽니다. 페이지 범위를 더 작게 나누어 주세요.');
    }
    return {
      mimeType: 'application/pdf',
      base64Data: u8ToBase64(bytes),
      fileName: cached.fileName,
      pageStart: start,
      pageEnd: end,
      sourceId,
    };
  }

  async function getDocumentInputForTopic(topicId: string): Promise<AiDocumentInput | null> {
    const link = (await getTopicSourceLinks(topicId))[0];
    return link ? getDocumentInputForSource(link.sourceId, link.pageStart, link.pageEnd) : null;
  }

  async function handleDeleteSource(sourceId: string) {
    showAlert('자료 삭제', '이 자료와 과목 연결을 삭제하시겠습니까? 기존 과목과 문제는 유지됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          await deleteSource(sourceId);
          pdfMemoryCache.delete(sourceId);
          setSources(await getSources());
          showAlert('삭제 완료', '자료와 과목 연결을 삭제했습니다.');
        },
      },
    ]);
  }

  return {
    sourceTitle,
    setSourceTitle,
    sourceText,
    setSourceText,
    sourceTopicId,
    setSourceTopicId,
    sourceFileName,
    sourcePageCount,
    sourcePageStart,
    setSourcePageStart,
    sourcePageEnd,
    setSourcePageEnd,
    handlePickSourceFile,
    handleSaveSource,
    handleReconnectSource,
    hasPdfInMemory,
    getDocumentInputForSource,
    getDocumentInputForTopic,
    handleDeleteSource,
  };
}
