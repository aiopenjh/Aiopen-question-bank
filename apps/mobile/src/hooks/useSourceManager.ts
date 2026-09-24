/**
 * Study material manager.
 * PDF bytes stay in memory only. IndexedDB stores metadata, links and generated learning data.
 */

import { useState } from 'react';
import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
// The bundled ESM build avoids Metro's production-only interop failure in pdf-lib's
// unbundled tslib dependency while keeping PDF work local to the device.
// Resolve the same bundled ESM build only when PDF work is requested.
const loadPdfLibrary = () => import('pdf-lib/dist/pdf-lib.esm.js');
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
import { unzipSync, strFromU8, u8ToBase64 } from '../utils/backupArchive';
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

// 네이티브는 선택기가 넘겨준 원본 URI(Android content://)를 새 File API로 직접 읽는다.
// Android는 캐시 복사본을 구형 FileSystem으로 읽을 때 READ 권한 오류가 나므로 원본을 쓴다.
async function readPickedBytes(file: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web' && (file as any).file) {
    return new Uint8Array(await (file as any).file.arrayBuffer());
  }
  return new ExpoFile(file.uri).bytes();
}

async function readPickedText(file: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web' && (file as any).file) {
    return (file as any).file.text();
  }
  return new ExpoFile(file.uri).text();
}

// 웹·Android·iOS 모두 파일 전체의 SHA-256을 쓴다. 같은 PDF는 기기와 관계없이 같은 식별값이 된다.
// 대용량 PDF 메모리를 늘리지 않도록 읽은 바이트를 복사하지 않고 그대로 해시한다.
async function fingerprintBytes(bytes: Uint8Array): Promise<string> {
  const hash = await digest(CryptoDigestAlgorithm.SHA256, bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(hash))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function pickSingleDocument(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    // Android: 원본 content:// 권한으로 읽는다. iOS: 선택 즉시 읽으려면 캐시 복사가 필요하다
    // (Expo DocumentPicker 문서). 웹은 브라우저 File 객체를 쓰므로 영향이 없다.
    copyToCacheDirectory: Platform.OS !== 'android',
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
  const [isSourceFileLoading, setIsSourceFileLoading] = useState(false);

  function applyLargePdfDefault(pageCount: number): boolean {
    setSourcePageStart(1);
    setSourcePageEnd(Math.min(RECOMMENDED_PDF_PAGE_BLOCK, pageCount));
    if (pageCount <= LARGE_PDF_PAGE_THRESHOLD) return false;

    showAlert(
      'PDF 페이지가 많습니다',
      `선택한 PDF는 총 ${pageCount}페이지입니다.\n\n전체 문서를 한 번에 분석하면 처리 시간이 길어지고 연결된 AI 서비스의 무료 할당량을 초과하거나 429 제한이 발생할 수 있습니다.\n\n필요한 페이지를 지정하거나 여러 구간으로 나누어 문제를 출제하는 것을 권장합니다.`,
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
    let startedLoading = false;
    try {
      const file = await pickSingleDocument();
      if (!file) return;
      startedLoading = true;
      setIsSourceFileLoading(true);
      const fileName = file.name;
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      if (ext === 'hwp' || ext === 'hwpx') {
        showAlert(
          '한글 문서 변환 안내',
          '한글 문서는 바로 읽을 수 없습니다. PDF 또는 텍스트(.txt)로 변환한 뒤 첨부해 주세요.'
        );
        return;
      }

      // 새 파일을 읽는 동안 이전 파일의 준비 상태가 새 파일명과 섞이지 않게 비운다.
      setPendingPdf(null);
      setSourceText('');
      setSourcePageCount(null);
      if (!sourceTitle.trim()) setSourceTitle(fileName.replace(/\.[^/.]+$/, ''));
      setSourceFileName(fileName);

      if (ext === 'pdf') {
        const { PDFDocument } = await loadPdfLibrary();
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
            `${fileName}\n총 ${pageCount}페이지를 확인했습니다.\n\nPDF 원본은 저장하지 않고 Celueste에 연결됩니다. 목차나 문제를 만들 때 선택한 페이지만 AI 분석에 사용됩니다.`
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
        extractedText = await readPickedText(file);
      } else {
        throw new Error('PDF, TXT, MD, CSV, JSON 또는 ZIP 파일만 지원합니다.');
      }

      setSourceText(extractedText);
      showAlert('파일 불러오기 완료', `“${fileName}” 내용을 읽었습니다. 자료 등록을 눌러 저장해 주세요.`);
    } catch (error: any) {
      console.warn('파일 첨부 실패:', error);
      showAlert('파일 불러오기 실패', error?.message || '파일을 읽지 못했습니다.');
    } finally {
      if (startedLoading) setIsSourceFileLoading(false);
    }
  }

  async function handleSaveSource(): Promise<boolean> {
    if (isSourceFileLoading) {
      showAlert('알림', '파일을 읽는 중입니다. 용량에 따라 몇 분 걸릴 수 있으니 완료될 때까지 기다려 주세요.');
      return false;
    }
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
      const { PDFDocument } = await loadPdfLibrary();
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
      pdfMemoryCache.set(sourceId, { bytes, fingerprint, fileName: file.name, pageCount: pdf.getPageCount() });
      showAlert(
        '원본 PDF 연결 완료',
        'PDF 원본을 저장하지 않고 Celueste에 연결했습니다. 이번 실행 중 목차나 문제를 만들 때 선택한 페이지만 AI 분석에 사용됩니다.'
      );
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
    const { PDFDocument } = await loadPdfLibrary();
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
    isSourceFileLoading,
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
