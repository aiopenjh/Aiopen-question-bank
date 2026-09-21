# Celueste 랭킹 API 초안

## 1. 기본 계약

- Base URL 예시: `https://ranking-api.example.workers.dev/v1`
- 전송 형식: HTTPS + JSON
- 날짜 기준: `Asia/Seoul`
- 참여자 인증: 기기 토큰을 `Authorization: Bearer <token>`으로 전송
- 복구 토큰과 기기 토큰은 서버 DB에 원문으로 저장하지 않고 해시만 저장
- 허용 Origin: 운영 GitHub Pages 주소와 승인된 로컬 개발 주소

Base URL과 실제 도메인은 서버 선택 후 확정한다.

## 2. 서버에 저장하는 데이터

### `participants`

| 필드 | 설명 |
| --- | --- |
| `id` | 서버가 만든 참여자 ID |
| `nickname` | 랭킹에 공개하는 고유 닉네임 |
| `recovery_token_hash` | 복구 토큰 해시 |
| `device_token_hash` | 현재 기기 인증 토큰 해시 |
| `created_at` | 참여 등록 시각 |
| `updated_at` | 마지막 변경 시각 |
| `deleted_at` | 탈퇴 요청 시각. NULL이 아니면 즉시 공개 랭킹에서 제외되고, 이 값으로부터 3일 뒤 참여자와 관련 기록이 일괄 삭제된다 |

### `daily_learning`

| 필드 | 설명 |
| --- | --- |
| `participant_id` | 참여자 ID |
| `study_date` | 서버가 확정한 한국 날짜 |
| `solved_count` | 해당 날짜에 연동된 완료 문제 수의 최댓값 |
| `qualified_consistency` | `solved_count >= 3` 여부 |
| `last_sync_at` | 마지막 연동 시각 |

`participant_id + study_date`를 고유 키로 사용한다.

### `participant_stats`

| 필드 | 설명 |
| --- | --- |
| `participant_id` | 참여자 ID |
| `total_solved` | 날짜별 `solved_count`의 합계 |
| `current_streak` | 현재 연속 유효 학습일 |
| `best_streak` | 최고 연속 유효 학습일 |
| `last_qualified_date` | 마지막 유효 학습일 |
| `max_killer_level` | 초고난도 도전 랭킹: 전체 기간 최고 도달 킬러 문항(31레벨 이상) 레벨. 일별 기록 없이 전송값과 MAX 비교만 한다 |
| `updated_at` | 마지막 집계 시각 |

## 3. 절대 전송하거나 저장하지 않는 값

- Gemini 또는 다른 개인 API 키
- 문제 지문, 보기, 정답과 해설
- 과목명, 단원명과 사용자가 입력한 주제
- 전체 오답노트와 풀이 이력
- 기기 연락처, 전화번호와 위치

## 4. 엔드포인트

### 4.1 참여자 등록

`POST /participants`

요청:

```json
{
  "nickname": "공부별"
}
```

응답:

```json
{
  "participantId": "pt_...",
  "nickname": "공부별",
  "deviceToken": "dt_...",
  "recoveryToken": "rt_...",
  "createdAt": "2026-09-16T10:00:00Z"
}
```

`recoveryToken`은 등록 응답에서 한 번만 원문으로 전달한다. 앱은 기기 보안 저장소와 백업 데이터에 보관하되 화면에 평문으로 계속 노출하지 않는다.

### 4.2 참여자 복구

`POST /participants/recover`

요청:

```json
{
  "participantId": "pt_...",
  "recoveryToken": "rt_..."
}
```

응답은 새로운 `deviceToken`과 현재 닉네임을 반환한다. 복구가 성공하면 이전 기기 토큰을 폐기할지 여부는 구현 단계에서 정책을 확정한다.

### 4.3 오늘 기록 연동

`POST /sync/today`

헤더:

```text
Authorization: Bearer dt_...
Idempotency-Key: pt_...-2026-09-16-<random>
```

요청:

```json
{
  "localDate": "2026-09-16",
  "timezone": "Asia/Seoul",
  "solvedCount": 10,
  "maxKillerLevel": 33
}
```

`localDate`는 사용자 안내와 날짜 오류 확인용이다. 저장 날짜는 서버가 판단한 한국 날짜를 사용한다. 클라이언트가 `qualifiedConsistency`를 보내지 않으며 서버가 `solvedCount >= 3`으로 계산한다. `maxKillerLevel`은 기기가 계산한 "정답 처리된 킬러 문항(31레벨 이상)의 최고 레벨"이며 생략하면 갱신하지 않는다(0 이상 정수).

응답:

```json
{
  "studyDate": "2026-09-16",
  "solvedCount": 10,
  "qualifiedConsistency": true,
  "totalSolved": 124,
  "currentStreak": 7,
  "maxKillerLevel": 33,
  "solvedRank": 4,
  "consistencyRank": 2,
  "killerRank": 6,
  "leaderboardUpdatedAt": "2026-09-16T10:05:00Z"
}
```

서버 갱신 규칙:

```text
newSolvedCount = MAX(storedSolvedCount, requestedSolvedCount)
qualifiedConsistency = newSolvedCount >= 3
newMaxKillerLevel = MAX(storedMaxKillerLevel, requestedMaxKillerLevel)
```

`maxKillerLevel`은 `daily_learning`처럼 날짜별로 나뉘지 않고 `participant_stats.max_killer_level`에 전체 기간 기준으로만 반영된다.

같은 참여자와 날짜의 저장, 통계 갱신과 결과 조회는 하나의 논리적 트랜잭션으로 처리한다. 같은 요청이 재전송되어도 총합과 연속 일수가 한 번만 바뀌어야 한다.

### 4.4 랭킹 조회

`GET /leaderboard?limit=N`

`limit`은 각 항목에서 반환할 상위 인원 수다. 생략하면 `1`이며 최대값은 `50`이다. 메인 화면 카드는 기본값으로 1위만 받고, 랭킹 창(계획서 §3.3)은 `limit`을 키워 전체 목록을 받는다.

공개 응답:

```json
{
  "mostSolved": [
    { "rank": 1, "nickname": "공부별", "value": 1240 },
    { "rank": 2, "nickname": "꾸준이", "value": 980 }
  ],
  "mostConsistent": [
    { "rank": 1, "nickname": "매일세문제", "value": 42 }
  ],
  "mostKillerLevel": [
    { "rank": 1, "nickname": "킬러왕", "value": 40 }
  ],
  "updatedAt": "2026-09-16T10:05:00Z"
}
```

`value`는 `mostSolved`에서 누적 완료 문제 수, `mostConsistent`에서 연속 학습일, `mostKillerLevel`에서 최고 도달 킬러 문항 레벨을 뜻한다. 세 목록은 서로 독립적으로 정렬하므로 같은 참여자가 여러 목록에 동시에 나타날 수 있다(계획서 §10-2). 참여자가 없으면 빈 배열을 반환한다. 동점자에게 같은 순위를 부여하는 처리는 초기 범위 밖이다.

초기 버전의 공개 응답에는 참여자 ID, 일별 기록과 복구 정보를 포함하지 않는다. 인증된 참여자가 자신의 순위를 조회하는 응답은 별도 `me` 항목으로 분리할 수 있다.

### 4.5 닉네임 변경

`PATCH /participants/me/nickname`

변경 주기 정책이 확정된 뒤 구현한다. 중복·금칙어 검사는 등록과 동일하게 적용한다.

### 4.6 랭킹 탈퇴

`DELETE /participants/me`

탈퇴 요청 시 즉시 삭제하지 않고 `participants.deleted_at`에 요청 시각을 기록한다. 닉네임은 탈퇴 요청 즉시 공개 랭킹(`GET /leaderboard`)에서 제외한다. 서버는 `deleted_at`으로부터 3일이 지난 참여자와 그 `daily_learning`, `participant_stats` 기록을 일괄 삭제한다(스케줄 작업 또는 조회 시 지연 삭제로 구현).

유예 기간(3일) 중 같은 `deviceToken` 또는 `recoveryToken`으로 `POST /sync/today` 또는 `POST /participants/recover`를 호출하면 탈퇴 요청은 취소되고 `deleted_at`을 초기화한다.

응답:

```json
{
  "status": "PENDING_DELETION",
  "scheduledDeletionAt": "2026-09-19T10:00:00Z"
}
```

## 5. 검증과 호출 제한

- `solvedCount`는 0 이상의 정수만 허용한다.
- 초기 권장 일일 상한은 500문제이며, 초과 값은 `422`로 거절하고 서버 로그에 개인 학습 내용 없이 이상 요청만 기록한다.
- 참여자별 등록, 복구, 연동 API에 호출 제한을 둔다.
- 닉네임은 Unicode 정규화 후 길이, 중복, 금칙어를 검사한다.
- 서버는 요청 본문과 토큰 원문을 일반 로그에 남기지 않는다.
- 운영용 DB 접근 키와 관리 키는 웹앱 코드에 넣지 않는다.

일일 상한 500은 보안용 초기 제안이며 실제 사용량을 본 뒤 조정한다.

## 6. 오류 형식

```json
{
  "error": {
    "code": "NICKNAME_TAKEN",
    "message": "이미 사용 중인 닉네임입니다."
  }
}
```

| HTTP | 코드 | 처리 |
| --- | --- | --- |
| `400` | `INVALID_INPUT` | 형식 오류 안내 |
| `401` | `INVALID_DEVICE_TOKEN` | 백업을 이용한 복구 안내 |
| `409` | `NICKNAME_TAKEN` | 다른 닉네임 입력 안내 |
| `409` | `DATE_MISMATCH` | 기기 날짜 확인 후 재시도 안내 |
| `422` | `COUNT_OUT_OF_RANGE` | 완료 수 재계산 후 재시도 |
| `429` | `RATE_LIMITED` | 잠시 뒤 재시도 안내 |
| `500` | `SERVER_ERROR` | 로컬 기록 보존, 연동 실패 안내 |
| `503` | `SERVICE_UNAVAILABLE` | 요청을 로컬 대기 상태로 유지 |

## 7. 클라이언트 저장 항목

```ts
type RankingProfile = {
  nickname: string;
  participantId: string;
  deviceToken: string;
  recoveryToken: string;
  lastSyncedDate?: string;
  lastSyncedSolvedCount?: number;
};
```

- `deviceToken`과 `recoveryToken`은 가능한 플랫폼에서는 보안 저장소에 둔다.
- 웹 백업에는 복구에 필요한 값만 포함하고 `deviceToken`은 새 기기 복구 과정에서 다시 발급받는다.
- 전체 데이터 초기화 시 로컬 랭킹 자격 정보도 함께 지우며, 서버 탈퇴는 별도 확인 절차로 실행한다.
