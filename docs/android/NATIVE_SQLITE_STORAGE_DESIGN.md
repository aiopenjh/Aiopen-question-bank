# Android 네이티브 저장소 SQLite 전환 설계

- 작성: 2026-09-23, 브랜치 `feature/android-app` (기준 커밋 `7d99fa0`)
- 상태: **설계안 (구현 전 검토용)** — 코드 변경 없음
- 관련 규칙: `AGENTS.md` §2-A-7 데이터 호환성과 복구 가능성

## 1. 목적과 범위

Android 앱의 학습 데이터 저장소를 AsyncStorage에서 SQLite(`expo-sqlite`)로 옮겨 용량 한계와 부분 저장 위험을 없앤다.

- **대상:** 네이티브(Android, 추후 iOS)만.
- **웹은 변경하지 않는다.** 운영 중인 웹의 IndexedDB 데이터 형식과 동작을 그대로 유지한다.
- **API 키는 대상 아님.** `integrations/secure_storage.ts`(SecureStore)는 그대로 둔다.
- **공개 함수 시그니처 유지.** `data/db.ts`와 `data/repositories/*`의 공개 함수 시그니처를 바꾸지 않아, 화면·훅 코드를 수정하지 않는다.

## 2. 현재 구조 (코드 확인 결과)

| 항목 | 현재 |
|---|---|
| 저장소 경계 | `src/data/app_storage.ts` — 웹: IndexedDB `celueste-learning-data`/`key-value` 스토어, 네이티브: AsyncStorage |
| 공개 API | `getItem, setItem, removeItem, multiGet, multiSet, multiRemove, getAllKeys, clear` (+ `initializeAppStorage`) |
| 사용처 | `db.ts`, `repositories/{question,source,topic_unit,backup,ranking}_repository.ts`, `utils/notifications.ts` |
| 저장 방식 | 컬렉션 전체를 키 하나에 JSON 배열로 저장 (`STORAGE_KEYS.QUESTIONS`, `ATTEMPTS`, `REVIEW_STATES`, `SOURCE_CHUNKS` 등) |
| 쓰기 패턴 | 읽기 → 배열 수정 → 전체 재저장. 예: `saveAttempt`는 제출 1건마다 ATTEMPTS 전체를 다시 씀 |
| 다중 키 원자성 | 수동 스냅샷/복원 (`topic_unit_repository.ts` `writeWithRollback`, `backup_repository.ts` 복원 롤백) |
| 기존 이관 선례 | 웹 AsyncStorage/localStorage → IndexedDB: 복사 → 값 검증 → 완료 마커 → 원본 보존, 실패 시 기존 저장소 유지 |
| 테스트 | `tests/app_storage.test.cjs`(IndexedDB 가짜), `tests/storage.test.cjs`(백업 왕복, 롤백, 멱등 제출 등) |

## 3. 문제

Android AsyncStorage 공식 제한: **전체 기본 6MB**, **항목 1개 읽기 2MB 초과 불가**(CursorWindow).

크기 근거 (추정 포함):

- 기본 탑재 문제 3개 실측: 문제당 약 1.6KB. AI 생성 문제는 해설·개념 정의·힌트가 붙어 더 크다. → 천 개 전후에서 2MB에 근접 (추정)
- **`SOURCE_CHUNKS`가 가장 먼저 한계에 닿는다.** 텍스트 자료는 청크 1개에 전문을 `rawText`와 `normalizedText`로 **두 번** 저장한다(`useSourceManager.ts` 자료 저장부). 한국어 약 35만 자(UTF-8 약 1MB) 교재 하나면 단일 키가 2MB를 넘는다 (계산값, 실측 아님)
- `ATTEMPTS`는 풀이마다 누적되어 기간이 길수록 문제 수보다 빨리 커질 수 있다

## 4. expo-sqlite 확인 결과

공식 문서 기준 (docs.expo.dev/versions/latest/sdk/sqlite):

- SQLite를 라이브러리에 **번들**해서 사용한다. Android 시스템 SQLiteDatabase/CursorWindow 경로가 아니다.
- **트랜잭션 API 두 가지:**
  - `withTransactionAsync`는 실행 중인 다른 쿼리까지 트랜잭션에 섞일 수 있다.
  - `withExclusiveTransactionAsync`는 스코프 안의 쿼리만 포함한다.
  - 쓰기 트랜잭션 중 다른 비동기 쓰기는 `database is locked`로 실패할 수 있다.
- `expo-sqlite/kv-store`가 AsyncStorage 호환 API를 제공한다.
- **웹 지원은 alpha**이고 COOP/COEP 헤더와 SharedArrayBuffer가 필요하다. GitHub Pages는 커스텀 헤더를 설정할 수 없어 웹에서는 사용하지 않는다.
- WAL 모드 사용을 권장한다.
- Expo Go에 포함되어 있어, EAS 빌드 전에도 실기기에서 검증할 수 있다.

**문서로 확인하지 못한 항목 (구현 1단계 착수 전 실기기에서 검증):**

- V1. 2MB 초과 단일 값(예: 5MB 문자열) 쓰기·읽기 성공 여부
- V2. 예외 발생 시 `withExclusiveTransactionAsync` 롤백 동작
- V3. 동시 비동기 쓰기 시 `database is locked` 발생 조건
- V4. 규모별 성능: 문제 5,000개, 풀이 20,000건 기준 전체 읽기·저장 시간
- V5. SDK 57 대응 `expo-sqlite` 버전 (`npx expo install expo-sqlite`로 결정)

## 5. 설계 결정

| ID | 결정 | 이유 |
|---|---|---|
| D1 | 네이티브만 SQLite, 웹은 IndexedDB 유지 | 웹 SQLite는 alpha이고 GitHub Pages에서 필수 헤더를 설정할 수 없다. 운영 웹 데이터 이관 위험도 없앤다 |
| D2 | `kv-store` 헬퍼 대신 단일 DB 파일 `celueste.db`에 자체 `kv` 테이블 | 작은 키와 이후 컬렉션 테이블을 **하나의 트랜잭션**으로 묶을 수 있다(백업 복원, 과목 삭제 연쇄). 구현량도 작다 |
| D3 | 2단계 전환 | 1단계로 용량 한계를 먼저 제거하고, 성능 개선(2단계)은 측정 후 진행 |
| D4 | 모든 쓰기를 단일 큐로 직렬화하고, 다중 쓰기는 `withExclusiveTransactionAsync` | `database is locked` 방지. 현재 코드의 비동기 쓰기 순서를 보존 |
| D5 | 2단계의 웹 구현은 기존 키-값 JSON 배열을 그대로 쓰는 어댑터 | 웹 데이터 형식이 바뀌지 않아 웹 마이그레이션이 필요 없다. 백업 형식도 불변 |

## 6. 1단계 — 네이티브 kv 백엔드 교체 (클로즈드 테스트 전 필수)

### 6.1 스키마

```sql
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
-- 스키마 버전·이관 마커는 예약 키로 kv에 저장: '__celueste:sqlite-schema', '__celueste:sqlite-migration-v1'
```

### 6.2 API 매핑 (`app_storage.ts` 공개 API 불변)

| 공개 API | SQLite 구현 |
|---|---|
| `getItem(k)` | `SELECT value FROM kv WHERE key = ?` |
| `setItem(k, v)` | `INSERT ... ON CONFLICT(key) DO UPDATE` (쓰기 큐 경유) |
| `multiGet(ks)` | `SELECT key, value FROM kv WHERE key IN (...)`, 요청 순서대로 정렬해 반환 |
| `multiSet(es)` | 단일 exclusive 트랜잭션 안에서 upsert 반복 → **다중 키 원자성 확보** |
| `removeItem/multiRemove` | `DELETE` (multi는 단일 트랜잭션) |
| `getAllKeys()` | `SELECT key FROM kv` (예약 키 제외) |
| `clear()` | `DELETE FROM kv` + AsyncStorage에 남은 앱 키 제거 (웹 `clear`와 같은 의미) |

`StorageBackend` 타입에 `'sqlite'`를 추가한다. `initializeAppStorage()`의 반환 타입이 넓어지지만 앱 내 호출부는 `db.ts:112` 한 곳뿐이고 반환값을 쓰지 않는다. 테스트(`app_storage.test.cjs`)의 기대값은 웹 경로라 영향이 없다.

### 6.3 AsyncStorage → SQLite 이관 (웹 선례와 동일한 절차)

1. SQLite를 열고 이관 마커를 확인한다. 완료 상태면 바로 SQLite를 사용한다.
2. AsyncStorage에서 앱 키(`@cogniquest:`, `@celueste:`, 비밀 키 제외)를 `multiGet`으로 읽는다.
3. 단일 exclusive 트랜잭션에서 전체를 `kv`에 쓰고, 같은 트랜잭션 안에서 마커를 기록한다.
4. 다시 읽어 원본과 값을 1:1 비교한다. 불일치하면 마커를 삭제하고 실패로 처리한다.
5. **AsyncStorage 원본은 삭제하지 않는다.** 최소 2개 릴리스 동안 복구용으로 보존한다(삭제는 별도 승인).
6. 실패하면 AsyncStorage 백엔드로 계속 동작하고 오류를 로그로 남긴다(현재 웹 폴백과 같은 정책). 다음 실행 때 재시도한다.

주의: AsyncStorage에 이미 2MB가 넘는 값이 있으면 2단계에서 읽기가 실패해 이관도 실패한다. 현재 네이티브 운영 사용자가 없어 실질 영향은 개발 기기로 한정된다.

### 6.4 영향 파일

- 신규 `src/data/native_sqlite_backend.ts`: DB 열기, WAL, kv CRUD, 쓰기 큐, 트랜잭션 (500줄 이하)
- 신규 `src/data/native_storage_migration.ts`: 6.3 이관 절차
- 수정 `src/data/app_storage.ts`: 네이티브 분기를 sqlite 백엔드로 연결. 웹 분기는 변경 없음
- 수정 `package.json`: `expo-sqlite` 추가 (**신규 의존성, 승인 필요**)
- 신규 `tests/native_sqlite_storage.test.cjs`: Node 22 `node:sqlite`로 expo-sqlite 가짜 객체를 만들어 CRUD·원자성·이관·폴백을 검증
- 회귀 테스트: 기존 `tests/storage.test.cjs`, `tests/app_storage.test.cjs` 전부 통과

## 7. 2단계 — 대형 컬렉션 레코드 분리 (성능, 측정 후 진행)

1단계만 해도 용량 한계는 사라진다. 다만 "전체 배열 재저장"이 남아서 데이터가 커지면 저장이 느려진다. V4 측정 결과가 기준을 넘으면 진행한다. 기준 제안: 풀이 저장 1건에 200ms 초과.

### 7.1 대상과 스키마 (네이티브)

```sql
CREATE TABLE questions     (id TEXT PRIMARY KEY, topic_id TEXT, unit_id TEXT, data TEXT NOT NULL);
CREATE INDEX idx_questions_unit ON questions(topic_id, unit_id);
CREATE TABLE attempts      (id TEXT PRIMARY KEY, submission_key TEXT UNIQUE, data TEXT NOT NULL);
CREATE TABLE review_states (question_revision_id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE source_chunks (id TEXT PRIMARY KEY, revision_id TEXT, data TEXT NOT NULL);
CREATE INDEX idx_chunks_revision ON source_chunks(revision_id);
```

- `data`에는 레코드 JSON 전체를 저장한다. 타입 필드가 추가되어도 스키마를 바꿀 필요가 없다.
- 조회용 컬럼만 따로 복제한다.
- 기존 배열 순서는 `ORDER BY rowid`로 보존한다.
- `submission_key UNIQUE`는 기존 멱등 제출 규칙("repeated submissionKey saves only one attempt")과 대응한다.

### 7.2 컬렉션 인터페이스

```ts
interface CollectionStore<T> {
  getAll(): Promise<T[]>;
  upsertMany(items: T[]): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
  replaceAll(items: T[]): Promise<void>;   // 백업 복원용
}
// 여러 컬렉션·kv를 한 번에 바꾸는 작업(백업 복원, 과목 삭제 연쇄)
runAtomic(fn: (tx) => Promise<void>): Promise<void>;
```

- **네이티브:** 테이블 구현. `runAtomic`은 단일 exclusive 트랜잭션.
- **웹:** 기존 키의 JSON 배열을 읽고 쓰는 어댑터. `runAtomic`은 기존 스냅샷/복원 패턴을 재사용한다. 데이터 형식과 동작은 현재와 동일하다(D5).
- 리포지토리 공개 함수는 유지하고 내부만 교체한다. 예: `saveAttempt` → `attempts.upsertMany([a])`, `deleteQuestionsForUnit` → 대상 id 조회 후 `removeMany`.

### 7.3 kv 배열 → 테이블 이관

- 컬렉션별로 exclusive 트랜잭션 안에서 처리한다: kv 배열 파싱 → 행 삽입 → 건수 검증 → 컬렉션별 마커 기록 → 원본 kv 값은 `__legacy:<key>`로 보존.
- 실패하면 롤백하고, 해당 컬렉션은 kv 모드로 계속 동작한다.

### 7.4 백업·복원·초기화

- 백업 JSON 형식은 **변경하지 않는다.** 내보낼 때는 `getAll()` 결과를 기존과 같은 배열로 직렬화한다.
- 복원은 `runAtomic` 안에서 `replaceAll`과 kv 쓰기를 한 번에 처리한다. 실패 시 전체 롤백 (기존 테스트 "mid-restore failure rolls back every modified key"가 기준).
- 전체 초기화는 테이블 전체와 kv를 삭제하고, AsyncStorage에 남은 앱 키도 정리한다.

## 8. 검증 계획

1. **구현 전:** 실기기(Expo Go)에서 V1~V5 확인용 스크립트 실행 → 결과를 이 문서에 기록
2. **단위 테스트:** `node:sqlite` 기반 가짜 객체로 신규 테스트 작성, 기존 저장소 테스트 전부 회귀 통과
3. **타입 검사:** `npx tsc --noEmit` 0건
4. **실기기 시나리오:**
   - 신규 설치 → 과목·문제 생성 → 풀이 → 앱 강제 종료 후 재실행해 데이터 유지 확인
   - 5MB 교재 업로드
   - 백업 → 초기화 → 복원
   - AsyncStorage 데이터가 있는 기기에서 업데이트 설치 → 이관 확인
5. **웹 회귀 (2단계에서 필수):** 웹 빌드 후 기존 IndexedDB 데이터로 동일 시나리오 확인. 1단계는 웹 코드 경로를 바꾸지 않는다

## 9. 결정·승인 필요 사항

1. `expo-sqlite` 신규 의존성 추가 (1단계 착수 조건)
2. AsyncStorage 원본 보존 기간 (제안: 최소 2개 릴리스, 삭제는 별도 승인)
3. 2단계 진행 기준 (제안: V4 측정에서 풀이 저장 1건 200ms 초과 시)
4. 2단계 웹 어댑터 방식(D5) 채택 여부 — 웹의 레코드 분리는 필요할 때 별도 설계

## 10. 권장 일정

- **1단계:** 클로즈드 테스트 업로드 전에 완료 (용량 한계 제거는 출시 필수 조건)
- **2단계:** 클로즈드 테스트 중 성능 측정 후 결정. 학원 전체(200명) 배포 전 재평가
