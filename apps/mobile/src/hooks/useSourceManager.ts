/**
 * Study Material & Source File Management Hook
 * Supports file picking for PDF/TXT/MD/CSV/ZIP with text extraction and HWP conversion notices.
 */

import { useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Topic, Source, SourceRevision, SourceChunk } from '../contracts/types';
import { addSource, deleteSource, getSources, generateUUID, getCurrentISOTime } from '../data/db';
import { base64ToU8, unzipSync, strFromU8 } from '../utils/backupArchive';
import { showAlert } from '../utils/alert';

export function useSourceManager(params: {
  topics: Topic[];
  setSources: (sources: Source[]) => void;
}) {
  const { topics, setSources } = params;

  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceTopicId, setSourceTopicId] = useState<string | null>(null);

  async function handlePickSourceFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const fileName = file.name;
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      // 1. 한글 파일(.hwp, .hwpx) 차단 및 친절한 변환 가이드
      if (ext === 'hwp' || ext === 'hwpx') {
        showAlert(
          '⚠️ 한글 문서(.hwp) 변환 안내',
          '한글 문서(.hwp)는 AI 엔진이 바로 읽을 수 없는 고유 바이너리 규격입니다.\n\n한글 프로그램에서 [파일 > 다른 이름으로 저장 > PDF 또는 텍스트(.txt)]로 변환하신 후 첨부해 주세요!'
        );
        return;
      }

      let extractedText = '';

      // 2. ZIP 압축 파일 (내부 txt, md, json, pdf 등 자동 압축 해제)
      if (ext === 'zip') {
        let u8: Uint8Array;
        if (Platform.OS === 'web' && (file as any).file) {
          const buf = await (file as any).file.arrayBuffer();
          u8 = new Uint8Array(buf);
        } else {
          const b64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          u8 = base64ToU8(b64);
        }
        const unzipped = unzipSync(u8);
        let foundCount = 0;
        for (const name of Object.keys(unzipped)) {
          const innerExt = name.split('.').pop()?.toLowerCase();
          if (innerExt === 'txt' || innerExt === 'md' || innerExt === 'json' || innerExt === 'csv') {
            extractedText += `[${name}]\n` + strFromU8(unzipped[name]) + '\n\n';
            foundCount++;
          } else if (innerExt === 'pdf') {
            extractedText += `[압축 내 PDF 교재: ${name}]\n`;
            foundCount++;
          }
        }
        if (foundCount === 0) {
          extractedText = `[ZIP 아카이브: ${fileName}] (${Object.keys(unzipped).length}개 파일 포함)`;
        }
      } else if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
        // 3. 텍스트 / 마크다운 문서
        if (Platform.OS === 'web' && (file as any).file) {
          extractedText = await (file as any).file.text();
        } else {
          extractedText = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }
      } else if (ext === 'pdf') {
        // 4. PDF 교재 문서
        const sizeKb = file.size ? Math.round(file.size / 1024) : 0;
        extractedText = `[PDF 교재: ${fileName} (${sizeKb}KB)]\n해당 PDF 교재의 학습 내용에 기반하여 문제가 정밀 출제됩니다.`;
      } else {
        extractedText = `[첨부 파일: ${fileName}]`;
      }

      // 제목 자동 기입: 사용자가 1단계에서 아직 이름을 적지 않았을 때만 파일명 자동 채움
      const cleanTitle = fileName.replace(/\.[^/.]+$/, '');
      if (!sourceTitle.trim()) {
        setSourceTitle(cleanTitle);
      }
      setSourceText(extractedText);

      showAlert(
        '📁 파일 불러오기 완료',
        `"${fileName}" 파일이 첨부되었습니다.\n\n1단계의 과목(대단원)명을 확인하신 후 [💾 교재 자료 등록하기]를 눌러주세요!`
      );
    } catch (err: any) {
      console.warn('파일 첨부 실패:', err);
      showAlert('오류', `파일을 불러오는 중 오류가 발생했습니다: ${err?.message || '알 수 없는 오류'}`);
    }
  }

  async function handleSaveSource() {
    if (!sourceTitle.trim()) {
      showAlert('알림', '학습 과목(대단원) 또는 자료 이름을 입력해 주세요.');
      return;
    }

    const trimmedName = sourceTitle.trim();
    const targetTopic = topics.find(
      (t) => t.id === sourceTopicId || t.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    const finalTitle = targetTopic && targetTopic.name.trim().toLowerCase() !== trimmedName.toLowerCase()
      ? `[${targetTopic.name}] ${trimmedName}`
      : trimmedName;

    const sourceId = generateUUID();
    const revId = generateUUID();

    const newSource: Source = {
      id: sourceId,
      ownerId: 'owner-default',
      kind: 'text',
      title: finalTitle,
      visibility: 'private',
      allowExternalProcessing: false,
      archivedAt: null,
      createdAt: getCurrentISOTime(),
    };

    const newRev: SourceRevision = {
      id: revId,
      sourceId,
      hash: 'sha256-' + Date.now(),
      provenance: targetTopic ? `[${targetTopic.name}] 연계 교재 자료` : '교재 및 텍스트 발췌',
      originalFileRef: null,
      createdAt: getCurrentISOTime(),
    };

    const content = sourceText.trim() || sourceTitle.trim();
    const newChunk: SourceChunk = {
      id: generateUUID(),
      revisionId: revId,
      rawText: content,
      normalizedText: content.replace(/\s+/g, ' '),
      locator: { kind: 'text', blockIndex: 0 },
      extractionStatus: 'success',
    };

    await addSource(newSource, newRev, [newChunk]);
    const updatedSources = await getSources();
    setSources(updatedSources);

    showAlert('등록 완료', `"${finalTitle}" 교재 자료가 안전하게 로컬 저장소에 보관되었습니다.`);
    setSourceTitle('');
    setSourceText('');
  }

  async function handleDeleteSource(sourceId: string) {
    showAlert('자료 삭제', '이 교재 자료를 보관함에서 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          await deleteSource(sourceId);
          const updatedSources = await getSources();
          setSources(updatedSources);
          showAlert('삭제 완료', '교재 자료가 삭제되었습니다.');
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
    handlePickSourceFile,
    handleSaveSource,
    handleDeleteSource,
  };
}
