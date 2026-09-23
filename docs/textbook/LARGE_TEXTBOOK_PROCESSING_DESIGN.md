# 대용량 학원 교재 서버 처리 설계

- 작성: 2026-09-24, 브랜치 `feature/android-app` (기준 커밋 `24fea05`)
- 상태: **설계안 — 서버 코드 없음, 구현 전 결정 필요**
- 관련 규칙: `AGENTS.md` §2-A-2 로컬 퍼스트와 명시적 외부 전송, §2-A-6 서버 신뢰 경계, §2-A-7 복구 가능성

## 0. 요약

선생님이 PDF 교재 하나(200MB 이상 고화질 스캔 포함) 또는 스캔 이미지 묶음을 **한 번만** 서버에 올리면, 서버가 페이지 분리·축소·회전 보정·OCR을 끝까지 처리한다. 이후에는 원본을 다시 고르지 않고 1~20, 21~40페이지처럼 구간만 바꿔 반복 출제한다. AI에는 선택 구간의 가공 페이지나 OCR 텍스트만 보낸다.

- 앱·Worker는 원본 파일 전체를 메모리에 올리지 않는다. 앱은 파트 단위(예: 16MiB)로 R2에 직접 올리고, Worker는 승인·상태 API만 맡는다.
- 무거운 작업(PDF 렌더링, HEIC 변환, OCR)은 Worker가 아니라 **디스크가 있는 별도 처리기**(권장: Cloudflare Containers)가 한 페이지씩 처리한다.
- 문제·풀이 기록은 지금처럼 기기에 남는다. 서버에는 교재 파일과 교재 메타데이터만 둔다.
- 이 기능은 "학습 데이터는 기기에 저장" 원칙의 **명시적 예외**다. 사용자 동의 없이는 켜지지 않는다.

## 1. 현재 구조와 한계 (코드 확인 결과)

| 항목 | 현재 (`useSourceManager.ts`, `ai_client.ts`) |
|---|---|
| PDF 읽기 | 파일 전체를 `Uint8Array`로 읽고 `pdf-lib`의 `PDFDocument.load`로 전체를 파싱한다 |
| 원본 보관 | 저장하지 않는다. 메모리 캐시(`pdfMemoryCache`)만 쓰며 앱을 다시 켜면 "원본 PDF 다시 선택"이 필요하다 |
| 출제 입력 | 선택 구간을 `pdf-lib`로 잘라 새 PDF를 만들고 base64로 바꿔 Gemini `inlineData`로 보낸다. 잘린 파일은 48MB 이하만 허용한다 |
| 스캔본·이미지 | OCR이 없다. ZIP은 안의 TXT·MD·CSV·JSON만 읽고 이미지는 무시한다 |
| 제공자 | PDF 직접 출제는 사용자 Gemini 키(BYOK)만 지원한다 |

한계: 원본 전체, 파싱 객체, 잘린 PDF, base64 문자열이 동시에 메모리에 있다. 따라서 **200MB급 PDF는 현재 구조로 지원한다고 할 수 없다.** 실제 한계는 기기 메모리에 따라 다르며 측정하지 않았다. 13MB PDF의 Android 선택·페이지 수 확인은 `24fea05`의 범위다.

## 2. 플랫폼 제약 (2026-09-24 공식 문서 확인)

| 항목 | 값 | 설계 영향 |
|---|---|---|
| Workers 요청 본문 | Free·Pro 100MB, Business 200MB | 200MB 이상 원본은 Worker를 통과시킬 수 없다 → R2 직접 업로드 |
| Workers 메모리 | 격리 환경당 128MB | Worker에서 PDF·ZIP 파싱 금지 |
| Workers CPU | 유료 기본 30초, 최대 5분 | 페이지 처리 부적합 |
| R2 멀티파트 | 파트 5MiB~5GiB, 최대 10,000개, 마지막 파트 외 동일 크기, 미완료 업로드 기본 7일 후 자동 중단 | 16MiB 파트면 최대 약 156GiB |
| R2 presigned URL | GET·HEAD·PUT·DELETE, 1초~7일, S3 API 도메인에서만 동작 | 파트별 PUT URL 발급. 브라우저 업로드는 버킷 CORS 필요 |
| R2 요금 | 저장 $0.015/GB-월, Class A $4.50/백만, Class B $0.36/백만, 이그레스 무료, 무료 10GB-월 | 교재 200MB 1권 저장비 약 $0.003/월 |
| Queues | 메시지 128KB, 재시도 최대 100회, 소비자 실행 최대 15분, 보존 최대 14일 | 메시지에는 ID만 넣고 파일은 넣지 않는다 |
| Workflows | 단계 결과 1MiB, 단계 CPU 최대 5분, 상태 보존 30일 | 선택 사항: 단계별 재개가 필요할 때 |
| D1 | DB 최대 10GB(유료), 행·문자열 최대 2MB, 쿼리당 바인딩 100개 | OCR 텍스트는 D1이 아니라 R2에 둔다 |
| Containers | 2026-04-13 정식 출시(Workers Paid), 최대 4 vCPU·12GiB·디스크 20GB | 무거운 PDF·OCR 실행 위치 1순위 |
| Gemini 입력 | PDF 50MB 또는 1,000페이지, inline 요청 100MB, Files API 파일당 2GB·48시간 보관 | 선택 구간만 보내면 한도 여유가 크다 |

## 3. 업로드부터 출제까지 상태 흐름

### 3.1 교재 상태

```
draft ──> uploading ──> uploaded ──> queued ──> processing ──> ready
  │           │                         │           │            └─> (일부 실패) partially_ready
  │           └─> upload_expired        │           └─> failed (파일 손상·암호화·한도 초과)
  └────────────────── canceled <────────┘
ready / partially_ready / failed ──> deleting ──> deleted
```

| 상태 | 의미 | 사용자에게 보이는 표시 |
|---|---|---|
| `draft` | 메타데이터 생성, 업로드 승인 발급 | 업로드 준비 중 |
| `uploading` | 멀티파트 진행 중 | 업로드 n / N MB |
| `upload_expired` | 7일 안에 완료 안 됨(R2 자동 중단) | 다시 올리기 |
| `uploaded` | 파트 조립 완료, 크기 확인 | 처리 대기 |
| `queued` | 큐 등록 | 처리 대기 |
| `processing` | `stage`: `inspecting` → `pages` → `ocr` → `finalizing` | 페이지 n / N 처리 중 |
| `ready` | 모든 페이지 사용 가능 | 출제 가능 |
| `partially_ready` | 일부 페이지 실패 | 실패 페이지 표시, 나머지 출제 가능 |
| `failed` | 교재 전체 실패 | 원인과 다시 시도 |
| `deleting` → `deleted` | 삭제 요청 후 R2 정리 | 목록에서 제외 |

### 3.2 페이지 상태

`pending → processing → ready | failed`. OCR은 `ocr_status`(`not_needed | pending | done | failed`)로 따로 둔다.

- 텍스트 레이어가 충분한 PDF 페이지는 OCR을 건너뛴다(`not_needed`).
- **처리가 끝난 페이지부터 먼저 출제할 수 있다.** 1~20페이지가 `ready`면 뒤쪽이 처리 중이어도 그 구간 출제가 가능하다.

### 3.3 출제 흐름

1. 앱이 구간(예: 21~40)을 고른다.
2. `POST /materials`로 해당 페이지가 `ready`인지 확인한다.
3. 서버가 페이지별 가공 이미지·텍스트의 서명 GET URL을 돌려준다(짧은 만료, 구간 상한 적용).
4. 앱이 그 페이지만 내려받아 지금처럼 사용자 Gemini 키로 출제한다.
5. 생성된 문제는 지금처럼 기기에 저장한다.
6. 사용한 구간은 `TopicSourceLink.lastProcessedPage`(기기)와 `textbook_ranges`(서버)에 기록한다.

AI 입력 방식은 텍스트, 이미지, 텍스트+이미지 중에서 고른다.
- 텍스트 레이어나 OCR 신뢰도가 높으면 텍스트만 보내 토큰을 줄인다.
- 그림·표·수식이 많은 페이지는 이미지를 함께 보낸다.
- 20페이지 × 페이지당 약 300KB면 약 6MB로, Gemini inline 한도(100MB)보다 훨씬 작다(페이지 크기는 추정값).

## 4. PDF와 이미지 ZIP 처리 흐름의 차이

| 단계 | PDF | 이미지 묶음 (ZIP 또는 여러 장 직접 선택) |
|---|---|---|
| 입력 | 파일 1개 | ZIP 1개, 또는 이미지 여러 장을 각각 업로드 (**ZIP 필수 아님**) |
| 검사 | 암호화 여부, 페이지 수, 손상 여부, 페이지별 텍스트 레이어 존재 여부 | ZIP 보안 검사(10장), 확장자·매직바이트, 픽셀 수 |
| 페이지 순서 | PDF 페이지 순서 | 파일명 자연 정렬(`2.jpg` < `10.jpg`). 직접 선택이면 선택 순서. 등록 전 미리보기에서 순서 확인 |
| 페이지 생성 | 페이지를 150~200 DPI 이미지로 렌더링(제안값) | 이미지 1장이 1페이지 |
| 변환 | 텍스트 레이어는 페이지별 텍스트로 추출 | HEIC·HEIF → JPEG, EXIF 방향 적용 |
| 보정 | 스캔 페이지만 기울기·회전 보정 | 모든 이미지에 기울기·회전 보정 |
| 축소 | 긴 변 약 2000px, JPEG·WebP 품질 약 80(제안값, 실측 후 결정) | 동일 |
| OCR | 텍스트 레이어가 없거나 부족한 페이지만 | 전 페이지 |
| 원본 활용 | 재처리가 필요할 때만 원본에서 다시 렌더링 | 재처리 시 ZIP 또는 개별 이미지 원본 사용 |

## 5. 직접 업로드·재시도·중단 후 재개

### 5.1 직접 업로드 (Worker 본문 미통과)

1. **생성:** `POST /v1/textbooks` → Worker가 한도를 확인하고 R2 멀티파트를 연다(`createMultipartUpload`). 응답은 `{ textbookId, uploadId, partSize, partCount }`.
2. **URL 발급:** `POST /v1/textbooks/{id}/upload-urls` `{ partNumbers }` → 파트별 presigned PUT URL(UploadPart). 만료는 짧게, 예: 1시간.
3. **전송:** 앱이 파트를 하나씩 읽어 PUT한다.
   - Android: 새 `File.open()`의 `FileHandle.readBytes(partSize)`로 파트 크기만큼만 읽는다.
   - 웹: `Blob.slice()`.
   - 동시 전송 2~3개. 메모리 상한은 대략 파트 크기 × 동시 수.
4. **완료:** `POST /v1/textbooks/{id}/upload/complete` `{ parts: [{ partNumber, etag }] }` → Worker가 조립하고, 객체 크기를 신고값과 비교한 뒤 큐에 `{ textbookId }`를 넣는다.

### 5.2 재시도

- **파트 단위:** 실패한 파트만 지수 백오프(1s, 2s, 4s… 상한 60s)로 재전송한다. 같은 파트 번호를 다시 올리면 덮어쓰므로 멱등이다.
- **URL 만료(403):** 해당 파트 URL만 다시 발급한다.
- **처리 단위:** 큐 메시지는 `textbookId`만 담는다.
  - 처리기는 D1의 페이지 상태를 보고 `ready`가 아닌 페이지만 처리한다. 같은 메시지가 두 번 와도 결과가 같다.
  - `processing_jobs.lease_until`로 동시 처리를 막는다.

### 5.3 중단 후 재개

- 앱은 기기 저장소에 업로드 기록을 남긴다: `{ textbookId, uploadId, partSize, completedParts[{n, etag}], fileName, size, lastModified }`.
- 다시 열면 `GET /v1/textbooks/{id}/upload`로 서버에 올라간 파트 목록(ListParts)을 받아 기기 기록과 합친다. 없는 파트만 보낸다.
- **원본 접근 권한:** Android 파일 선택기가 준 `content://` 권한은 앱을 다시 켜면 유지된다고 보장할 수 없다(실기기 확인 필요). 두 가지 안이 있다.
  - (권장) 업로드 전에 원본을 앱 전용 폴더로 네이티브 복사(`File.copy`, JS 메모리 미사용)하고, 업로드 완료 후 삭제한다. 교재 크기만큼 여유 공간이 필요하다.
  - (대안) 재개할 때 같은 파일을 다시 선택하게 하고, 크기와 앞뒤 1MiB 해시로 같은 파일인지 확인한다.
- **처리 단계의 재개:** 서버가 담당하므로 앱을 꺼도 계속된다. 앱은 다시 열 때 `GET /v1/textbooks`로 끝나지 않은 교재를 찾아 진행률을 보여 준다.

## 6. 진행률 표시

- **업로드:** 기기에서 보낸 바이트 / 전체 바이트, 파트 완료 수.
  - 네이티브 전송(`UploadTask`)을 쓰면 `onProgress`를 사용한다.
  - `fetch` 파트 전송이면 파트 완료 단위로 갱신한다.
- **서버 처리:** D1 `textbooks.processed_pages / page_count`, `stage`, `failed_pages`.
  - 처리기는 **N페이지마다 또는 5초마다 한 번**만 D1을 갱신해 쓰기 횟수를 줄인다(제안값).
- **조회 주기:** 앱이 화면에 보일 때만 `GET /v1/textbooks/{id}`를 호출한다. 간격은 2초 → 5초 → 15초로 늘리고, 끝나면 멈춘다. 푸시 알림은 1차 범위에서 제외한다.
- **예상 남은 시간:** 최근 페이지 평균 처리 시간 × 남은 페이지. "약"으로 표시한다.
- **실패 페이지:** 번호와 원인(렌더링 실패, 너무 큰 이미지, OCR 실패)을 보여 주고, 실패 페이지만 다시 처리하는 버튼을 둔다.

## 7. 데이터 모델

### 7.1 D1 (교재 서버 전용 DB. 랭킹 DB와 분리)

```sql
CREATE TABLE owners (
  id TEXT PRIMARY KEY,
  credential_hash TEXT NOT NULL,          -- 기기 발급 비밀값의 SHA-256 (랭킹 토큰과 별개)
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE textbooks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,              -- 'pdf' | 'image_zip' | 'images'
  status TEXT NOT NULL,
  stage TEXT,
  original_file_name TEXT,                -- 표시용. R2 키에는 쓰지 않는다
  original_size INTEGER NOT NULL,
  original_sha256 TEXT,                   -- 처리기가 스트리밍으로 계산
  upload_id TEXT,
  part_size INTEGER,
  page_count INTEGER,
  processed_pages INTEGER NOT NULL DEFAULT 0,
  failed_pages INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  processor_version TEXT,
  consent_version TEXT NOT NULL,          -- 동의한 안내문 버전
  original_delete_after TEXT,             -- 원본 보존 기한
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_textbooks_owner ON textbooks(owner_id, updated_at);

CREATE TABLE textbook_pages (
  textbook_id TEXT NOT NULL REFERENCES textbooks(id),
  page_no INTEGER NOT NULL,               -- 1부터
  status TEXT NOT NULL,
  source_ref TEXT NOT NULL,               -- PDF 페이지 인덱스 또는 ZIP 항목 순번
  has_text_layer INTEGER,
  ocr_status TEXT NOT NULL,
  width INTEGER, height INTEGER, rotation INTEGER,
  image_bytes INTEGER, text_chars INTEGER,
  error_code TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (textbook_id, page_no)
);

CREATE TABLE textbook_ranges (            -- 반복 출제 구간 (여러 기기에서 이어 쓰기용)
  id TEXT PRIMARY KEY,
  textbook_id TEXT NOT NULL REFERENCES textbooks(id),
  label TEXT,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  last_used_at TEXT
);

CREATE TABLE processing_jobs (
  textbook_id TEXT PRIMARY KEY REFERENCES textbooks(id),
  attempt INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE usage_monthly (
  owner_id TEXT NOT NULL,
  period TEXT NOT NULL,                   -- 'YYYY-MM' (Asia/Seoul)
  pages_processed INTEGER NOT NULL DEFAULT 0,
  ocr_pages INTEGER NOT NULL DEFAULT 0,
  material_requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, period)
);
```

- 페이지 텍스트는 D1 행 한도(2MB)와 쓰기 비용 때문에 **R2에 저장**한다. D1에는 글자 수만 둔다.

### 7.2 R2 키 구조 (사용자 입력 문자열을 키에 넣지 않음)

```
owners/{ownerId}/textbooks/{textbookId}/original/source.pdf | source.zip | images/{0001}.{ext}
owners/{ownerId}/textbooks/{textbookId}/pages/{0001}.jpg
owners/{ownerId}/textbooks/{textbookId}/text/{0001}.txt
```

### 7.3 기기 데이터 변경 (예상)

- `Source`에 `storage: 'local' | 'remote'`, `remoteTextbookId`, `remoteStatus`를 추가한다. 기존 자료는 `local`로 본다.
- `SourceRevision.originalFileRef`에 `remote:textbook/{id}`를 기록한다(지금은 항상 `null`).
- `AiDocumentInput`에 여러 부분 입력 형태를 추가한다: `{ kind: 'parts', parts: [{ mimeType: 'image/jpeg', base64 } | { text }] }`. 기존 PDF 형태는 유지한다.
- 업로드 재개 기록은 기기 저장소에 둔다. 백업에는 포함하지 않는다.

## 8. API 초안 (교재 전용 Worker `celueste-textbook-api`)

인증: `Authorization: Bearer <owner credential>`. 랭킹 토큰과 다른 비밀값이며, 서버에는 해시만 저장한다.

| 메서드·경로 | 요청 | 응답 | 비고 |
|---|---|---|---|
| `POST /v1/owners` | — | `{ ownerId, credential }` | 처음 한 번. IP 요청 제한 |
| `POST /v1/textbooks` | `{ title, sourceType, fileName, sizeBytes, mimeType, consentVersion }` | 201 `{ textbookId, uploadId, partSize, partCount }` | 한도 초과 413·429 |
| `POST /v1/textbooks/{id}/upload-urls` | `{ partNumbers: number[] }` (최대 20개) | `{ urls: [{ partNumber, url, expiresAt }] }` | |
| `GET /v1/textbooks/{id}/upload` | — | `{ uploadedParts: [{ partNumber, etag, size }] }` | 재개용 |
| `POST /v1/textbooks/{id}/upload/complete` | `{ parts: [{ partNumber, etag }] }` | 202 `{ status: 'queued' }` | 크기 불일치 422 |
| `DELETE /v1/textbooks/{id}/upload` | — | 204 | 멀티파트 중단 |
| `GET /v1/textbooks` | — | `{ textbooks: [...] }` | 진행 중 교재 찾기 |
| `GET /v1/textbooks/{id}` | — | 상태·단계·진행률·실패 수 | 조회 전용 요청 제한 |
| `GET /v1/textbooks/{id}/pages?from=&to=` | — | 페이지 상태 목록 (최대 200) | |
| `POST /v1/textbooks/{id}/materials` | `{ pageStart, pageEnd, mode: 'text'\|'image'\|'both' }` | `{ pages: [{ pageNo, textUrl?, imageUrl? }], expiresAt }` | 구간 상한 예: 50페이지, 서명 GET 10분 |
| `POST /v1/textbooks/{id}/retry` | `{ pages?: number[] }` | 202 | 실패 페이지만 재처리 |
| `PUT /v1/textbooks/{id}/ranges/{rangeId}` | `{ label, pageStart, pageEnd }` | 200 | 선택 사항 |
| `DELETE /v1/textbooks/{id}` | — | 202 | 즉시 숨김 → 정리 작업 |
| `DELETE /v1/owners/me` | — | 202 | 모든 교재 삭제 |

- **오류 코드:** 400 `INVALID_INPUT`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`(다른 소유자), 409 `INVALID_STATE`, 413 `TOO_LARGE`, 422 `UNSUPPORTED_FILE`·`ENCRYPTED_PDF`·`ZIP_REJECTED`, 429 `RATE_LIMITED`·`QUOTA_EXCEEDED`.
- **요청 제한 키:** 인증 전 경로는 IP 기준, 인증 후 경로는 **검증된 소유자 ID 기준**으로 건다.
  - 인증 헤더 원문을 키로 쓰면 헤더만 바꿔 제한을 우회할 수 있다. 랭킹 Worker에서 발견된 문제라 여기서는 처음부터 피한다.

## 9. 원본·가공본 삭제와 보존 기간 (제안값, 결정 필요)

| 대상 | 기본 보존 | 근거 |
|---|---|---|
| 미완료 멀티파트 | 7일 후 자동 중단 | R2 기본 수명 주기 |
| 원본 파일 | 처리 완료(`ready`) 후 30일 뒤 삭제. 사용자가 "원본 보관"을 켜면 교재 삭제 때까지 | 재처리(보정 방식 개선, OCR 재시도)에만 필요. 저장비보다 유출 위험 축소가 중요 |
| 가공 페이지·텍스트 | 교재를 삭제할 때까지 | 반복 출제의 기반 |
| 사용자 삭제 요청 | 즉시 목록·서명 URL 차단(`deleting`), 24시간 안에 R2 객체 삭제(정리 작업), D1 행은 30일 뒤 완전 삭제 | 되돌리기 요청 여유 |
| 장기 미사용 | 12개월 접속 없으면 알림 후 30일 뒤 삭제 | 비용·개인정보 최소화 |
| 고아 객체 | 매일 D1에 없는 R2 키 정리 | 실패·경합 대비 |

- 기기에서 **"전체 초기화"를 해도 서버 교재는 지워지지 않는다.** 초기화 확인창에서 서버 교재 삭제 여부를 따로 묻는다.
  - 랭킹 탈퇴 안내가 없는 현재 문제와 같은 종류이므로, 같이 설계한다.

## 10. 개인정보·저작권 안내 (업로드 전 1회 동의, 문구 버전 관리)

안내 항목:
1. 교재 파일 전체가 서버(Cloudflare R2)에 저장된다는 점과 저장 위치·보존 기간(9장).
2. 서버가 페이지 분리·보정·OCR을 한다는 점. OCR 텍스트도 저장된다.
3. 출제할 때 **선택한 페이지만** 사용자의 AI 제공자(현재 Google Gemini)로 전송된다는 점.
4. 삭제 방법과 삭제에 걸리는 시간.
5. 스캔본에 학생 이름·답안·연락처 같은 **개인정보가 들어가지 않게** 해 달라는 요청.
   - OCR로 텍스트가 되면 검색 가능한 형태로 남는다.
6. **저작권:** 업로드하는 사람이 사용 권리를 가진 자료(자체 제작 교재, 이용 허락을 받은 자료)만 올려야 한다는 점.
   - 비공개 개인 보관 용도이며 공유 기능은 없다.
   - 권리자 요청 시 삭제 절차를 둔다.

- 수업 목적 저작물 이용 규정이 학원에 어디까지 적용되는지, 국외 서버 보관 시 개인정보 국외 이전 고지가 필요한지는 **법률 검토가 필요하다**(이 문서는 법률 자문이 아님).
- `AGENTS.md` §2-A-2에 따라 "모든 데이터가 기기에만 저장된다"는 기존 안내 문구를 이 기능 사용자에게는 쓰지 않는다. 설명서(`UserManualModal`)와 설정 화면 문구도 함께 고친다.

## 11. 사용자별 한도 (제안값, 운영 비용 확인 후 결정)

| 한도 | 제안 초기값 | 목적 |
|---|---|---|
| 파일 1개 크기 | 1GB | 고화질 스캔 200MB 이상 수용. 처리기 디스크 20GB 안에서 원본·중간 파일 공존 |
| 교재 1권 페이지 수 | 1,000 | Gemini PDF 한도와 같은 기준, 처리 시간 상한 |
| 소유자 저장 용량 | 무료 2GB / 학원 요금제 별도 | R2 비용 |
| 월 처리 페이지 | 3,000 | 처리기 CPU 비용 |
| 월 OCR 페이지 | 3,000 (OCR 엔진 비용에 따라 조정) | OCR 비용 |
| 동시 처리 교재 | 소유자당 1개 | 공정성, 처리기 과부하 방지 |
| 출제 자료 요청 | 구간당 50페이지, 시간당 60회 | 서명 URL 남용 방지 |
| AI 비용 | BYOK: 사용자 키에 과금. 기존 20페이지 권장 구간 유지 | 운영자 AI 비용 없음 |

- 서버가 운영자 키로 AI를 호출하는 방식(관리형 프록시)은 **이번 설계 범위가 아니다**. 도입하려면 `AGENTS.md` §2-A-6의 인증·할당량·비용 제한을 먼저 설계한다.
- OCR을 AI 모델로 하는 경우(12장 안 C)가 여기에 해당한다.

## 12. ZIP 보안

처리기는 ZIP을 **디스크에 받은 뒤** 중앙 디렉터리를 읽고 항목을 **하나씩** 풀며 검사한다. 신고된 크기를 믿지 않고 실제로 푼 바이트를 센다.

| 규칙 | 내용 |
|---|---|
| 허용 확장자 | `.jpg .jpeg .png .heic .heif` (`.webp`는 결정 필요) |
| 매직바이트 | 확장자와 실제 형식이 다르면 거부 |
| 무시 항목 | `__MACOSX/`, `.DS_Store`, `Thumbs.db`, 빈 폴더 |
| 그 외 확장자 | ZIP 전체 거부, 거부한 파일명 목록 반환 |
| 중첩 압축 | `.zip .rar .7z .tar .gz .tgz .bz2 .xz`가 하나라도 있으면 ZIP 전체 거부 |
| 경로 조작 | `..` 구성요소, 절대 경로(`/`, `C:`), 역슬래시, NUL·제어 문자, 심볼릭 링크 항목, 255바이트 초과 이름 거부. 항목 이름을 파일 경로로 쓰지 않고 `0001.jpg`처럼 새 이름으로 푼다 |
| 중복 | 정규화 후 같은 이름이 있으면 거부 |
| 암호화 | 암호화된 항목이 있으면 거부 |
| 개수 | 항목 최대 2,000개 (페이지 한도 1,000 + 여유) |
| 총용량 | 압축 해제 합계 최대 3GB, 항목당 최대 100MB (제안값) |
| 압축률 | 항목별 해제/압축 비율 100:1 초과 시 거부 (ZIP 폭탄) |
| 이미지 폭탄 | 디코딩 전 헤더로 픽셀 수 확인, 1억 픽셀 초과 거부. 디코더 메모리 상한 설정 |
| 격리 | 처리기는 소유자별 임시 폴더, 작업 후 삭제, 외부 네트워크는 R2·D1만 허용 |

- 여러 장을 직접 선택해 올리는 경우에도 확장자·매직바이트·픽셀 수 규칙은 똑같이 적용한다.

## 13. 백업 정책

- 전체 백업 JSON에는 **교재 원본·가공 페이지·OCR 텍스트·서명 URL을 넣지 않는다.**
- 넣는 것: `Source` 메타데이터(`remoteTextbookId`, 제목, 페이지 수, 상태)와 구간 기록(`TopicSourceLink`).
- **교재 계정 복구 정보(owner credential)를 넣을지 결정이 필요하다.**
  - 넣으면 새 기기에서 백업 복원만으로 교재에 다시 접근할 수 있다. 대신 백업 파일이 유출되면 교재 접근 권한도 함께 유출된다.
  - 현재 랭킹 복구 토큰은 전체 백업에 포함하는 방식이다.
  - 권장: 같은 방식으로 포함하고 백업 화면에 "교재 접근 정보 포함" 안내를 표시한다. 문제만 백업에는 넣지 않는다.
- 복원한 기기에서 서버 교재가 이미 삭제됐으면 자료를 "서버에서 삭제됨"으로 표시하고, 기존 문제는 유지한다.

## 14. 로컬 `pdf-lib` 방식에서 서버 방식으로 전환하는 경계

| 조건 | 방식 |
|---|---|
| 텍스트 PDF, 페이지가 적고 원본 보관이 필요 없음, 서버 동의 안 함, 오프라인 | **로컬 유지** (현재 동작) |
| 원본을 다시 고르지 않고 반복 출제하고 싶음 | 서버 |
| 스캔본(텍스트 레이어 없음) — OCR 필요 | 서버 |
| 이미지 묶음(ZIP·여러 장) | 서버 |
| 기기에서 `PDFDocument.load`가 메모리 부족 등으로 실패 | 서버 사용 제안 (자동 업로드 금지, 동의 후) |

코드 경계는 두 곳뿐이다.
1. **입력:** `useSourceManager.handlePickSourceFile` — 파일 선택 후 "기기에서만 사용" / "서버에 보관" 선택.
2. **출제:** `useSourceManager.getDocumentInputForSource` — `storage`가 `local`이면 지금처럼 `pdf-lib`로 자르고, `remote`면 `materials` API로 받은 페이지를 `AiDocumentInput`으로 만든다. 호출하는 쪽(`useQuizGeneration`, `useCurriculumManager`, `generator`)은 입력 형태만 늘어난다.

- 기존 로컬 PDF 자료는 그대로 둔다. "서버에 등록"을 누르면 원본을 한 번 더 선택해 업로드하고, 같은 `Source`를 `remote`로 전환한다.
- 이때 지문(`fingerprint`)으로 같은 파일인지 확인한다. 웹은 SHA-256, Android는 표본 해시라 두 값이 다르다. 전환 전에 계산 방식을 통일해야 한다(전체 코드 점검 항목).

## 15. 단계별 구현 순서와 변경 예상 파일

| 단계 | 내용 | 변경·신규 파일 (예상) |
|---|---|---|
| 0. 결정·검증 | 소유자 인증 방식, 보존 기간, 한도, 동의 문구, 법률 검토. 실기기 검증 V-T1~V-T4(아래) | 이 문서 |
| 1. 서버 골격 | 교재 Worker, D1 마이그레이션, R2 버킷·CORS·수명 주기, 생성·URL 발급·완료·조회·삭제 API. 처리 없음 | 신규 `apps/textbook-worker/`(wrangler.toml, src/, migrations/, tests/), `docs/textbook/TEXTBOOK_API_SPEC.md` |
| 2. 처리기 (PDF) | 큐 소비 Worker, 컨테이너 이미지(PDF 렌더링·텍스트 추출·이미지 축소·회전 보정), 진행률 기록, 재시도, 정리 작업 | 신규 `apps/textbook-processor/`(Dockerfile, 처리 스크립트), textbook-worker의 큐 소비·cron |
| 3. 앱 업로드·출제 | 동의 화면, 파트 업로드·재개 기록, 진행률 카드, 원격 자료 출제, 백업 메타데이터 | `src/contracts/types.ts`, `src/hooks/useSourceManager.ts`, 신규 `src/hooks/useTextbookUpload.ts`, 신규 `src/integrations/textbook_client.ts`, `src/data/repositories/source_repository.ts`, `src/data/repositories/backup_repository.ts`, `src/domain/ai_client.ts`(여러 부분 입력), `src/domain/generator.ts`, `src/domain/curriculum_generator.ts`, `src/components/modals/SourceUploadModal.tsx`, `src/features/library/*`, `src/components/modals/UserManualModal.tsx`, 테스트 |
| 4. OCR·이미지 묶음 | OCR 엔진 연결, ZIP 보안 검사, HEIC 변환, 여러 장 직접 선택 | 처리기, `SourceUploadModal.tsx`, `useTextbookUpload.ts` |
| 5. 운영 | 한도·사용량 화면, 삭제·장기 미사용 정리, 모니터링 | textbook-worker, 설정 화면 |
| 이후 | 학원 계정(B2B), 학생 공유 | 별도 설계 |

**실기기 검증 (단계 0):**
- V-T1: `FileHandle.readBytes`로 200MB 파일을 16MiB씩 읽을 때 메모리 사용량과 속도.
- V-T2: `content://` 원본을 앱 폴더로 네이티브 복사하는 시간과 여유 공간 확인 방법.
- V-T3: 네이티브 `UploadTask`가 `content://`나 앱 폴더 파일을 presigned PUT으로 올릴 수 있는지.
- V-T4: 파일 선택기 권한이 앱 재시작 후에도 유지되는지.

## 16. 무거운 PDF·OCR 작업의 실행 위치

| 안 | 구성 | 장점 | 단점 |
|---|---|---|---|
| **A. Cloudflare Containers (권장)** | 큐 소비 Worker → Container(4 vCPU·12GiB·20GB 디스크까지). PDF 렌더러, 이미지 도구(HEIC 포함), OCR 엔진 설치 | R2·D1·Queues와 같은 플랫폼, 계정·배포 일원화, 이그레스 비용 없음 | 2026-04 정식 출시로 운영 사례가 적음, 콜드 스타트, 디스크 20GB 상한(교재 1GB 제한과 맞춤) |
| B. Google Cloud Run 작업 | R2에서 받아 처리 후 R2로 되돌림. OCR은 Cloud Vision 또는 Document AI | 한국어 OCR 품질이 검증된 관리형 서비스, 긴 작업 가능 | 두 클라우드 운영, 파일이 Google로 이동(개인정보 고지 추가), 요금 확인 필요 |
| C. 컨테이너 + AI 모델로 OCR | 페이지 이미지를 멀티모달 모델에 보내 텍스트화 | OCR 인프라 불필요, 표·수식 인식 유리 | 운영자 AI 키·비용 → §2-A-6 관리형 서버 설계 선행, 환각 위험(원문 대조 불가) |
| D. 자체 서버(학원 PC·VPS) | 작업을 가져가 처리하는 방식(pull) | 단위 비용 최저 | 가용성·보안·업데이트를 직접 운영 |

- OCR 엔진은 오픈소스(Tesseract 한국어, PaddleOCR 한국어)와 관리형(Cloud Vision) 중 **실제 학원 스캔 샘플 30~50페이지로 정확도·속도·비용을 비교한 뒤** 고른다.
- 권장 진행: 2단계는 **OCR 없이** 페이지 분리·축소·회전만 먼저 만든다. 이때 출제는 가공 이미지를 Gemini에 보내는 방식이다. 4단계에서 OCR을 붙여 텍스트 모드와 검색을 추가한다.

## 17. 결정이 필요한 사항

1. 교재 서버 도입 자체와 로컬 퍼스트 원칙의 예외 범위 (동의 문구 포함)
2. 소유자 인증 방식: 기기 발급 비밀값(1차) 또는 학원 계정(B2B)
3. 보존 기간·한도 제안값(9·11장)
4. 백업에 교재 접근 정보를 넣을지 (13장)
5. 처리기 실행 위치(16장 A 권장)와 OCR 엔진 선정 방법
6. 법률 검토: 학원 교재 저작권, 개인정보 국외 이전 고지

## 참고 (확인일 2026-09-24)

- Cloudflare Workers limits — https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare R2 limits / multipart / presigned URLs / pricing — https://developers.cloudflare.com/r2/platform/limits/ , https://developers.cloudflare.com/r2/objects/multipart-objects/ , https://developers.cloudflare.com/r2/api/s3/presigned-urls/ , https://developers.cloudflare.com/r2/pricing/
- Cloudflare Queues limits — https://developers.cloudflare.com/queues/platform/limits/
- Cloudflare Workflows limits — https://developers.cloudflare.com/workflows/reference/limits/
- Cloudflare D1 limits — https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare Containers limits / GA — https://developers.cloudflare.com/containers/platform-details/limits/ , https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/
- Gemini document processing / file input methods — https://ai.google.dev/gemini-api/docs/document-processing , https://ai.google.dev/gemini-api/docs/file-input-methods
