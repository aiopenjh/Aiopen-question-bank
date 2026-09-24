# Celueste Ranking Worker

Celueste 선택형 공동 랭킹 API. Cloudflare Workers + D1.
계약 상세는 [`docs/ranking/RANKING_API_SPEC.md`](../../docs/ranking/RANKING_API_SPEC.md),
[`docs/ranking/RANKING_FEATURE_PLAN.md`](../../docs/ranking/RANKING_FEATURE_PLAN.md) 참고.

운영 Worker: `https://celueste-ranking-api.celueste-ranking-worker.workers.dev`

웹 랭킹 탈퇴 요청 페이지: `apps/mobile/public/delete-account.html` (웹 배포 후 `/Aiopen-question-bank/delete-account.html`). 전체 백업 JSON에서 랭킹 복구 정보만 브라우저가 읽고 `POST /v1/participants/deletion-request`로 전송한다. 백업이 없는 사용자는 기존 의견 접수 경로로 지원을 요청한다.

운영 D1 `celueste-ranking`은 APAC에 생성되어 있으며, Worker에는 요청 제한과
매일 04:00 UTC 탈퇴 유예 정리 Cron이 연결되어 있다.

## 로컬 개발

```bash
cd apps/ranking-worker
npm install
wrangler d1 create celueste-ranking   # 최초 1회, database_id를 wrangler.toml에 반영
npm run db:migrate:local
npm run dev
```

`wrangler.toml`의 `database_id`는 자리표시자다. 로컬 개발만 할 때는
`wrangler d1 create` 실행 후 출력되는 로컬 ID를 채우지 않아도
`wrangler dev`가 로컬 SQLite로 대체 실행한다. 원격 배포 전에는 반드시
실제 D1 database_id로 교체한다.

## 테스트

```bash
npm test
```

닉네임 검증, 서울 날짜 계산과 D1 라우트 동작은 `node --test`로 검증한다.
실제 D1 바인딩 흐름은 `wrangler dev`에서 등록·동기화·랭킹·탈퇴 순서로 확인한다.

## 운영 확인 체크리스트

- [x] 원격 D1 생성 및 마이그레이션 적용
- [x] 운영 GitHub Pages와 로컬 개발 주소 CORS 허용
- [x] Worker Rate Limiting 바인딩 적용
- [x] 탈퇴 유예 정리 Cron 등록
- [x] `/v1/health`와 빈 리더보드 운영 응답 확인

## 절대 하지 않는 것

- 개인 API 키, 문제 지문/보기/정답/해설, 과목명·단원명을 저장하지 않는다.
- 토큰 원문을 로그에 남기지 않는다 (`console.error`는 에러 메시지만 남긴다).
