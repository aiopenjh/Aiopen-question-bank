# Celueste Ranking Worker

Celueste 선택형 공동 랭킹 API. Cloudflare Workers + D1.
계약 상세는 [`docs/ranking/RANKING_API_SPEC.md`](../../docs/ranking/RANKING_API_SPEC.md),
[`docs/ranking/RANKING_FEATURE_PLAN.md`](../../docs/ranking/RANKING_FEATURE_PLAN.md) 참고.

**이 디렉토리는 아직 배포되지 않았다.** `RANKING_SERVER_OPTIONS.md` §5의
"권장 운영 흐름" 1~2단계(로컬 모의 서버 검증 → Cloudflare 계정 생성)만
진행된 상태이며, 실제 Cloudflare 프로젝트 생성과 배포는 별도 승인 후 진행한다.

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

닉네임 검증, 서울 날짜 계산 등 서버리스 환경 없이 동작하는 순수 함수만
`node --test`로 검증한다. D1 바인딩이 필요한 라우트 핸들러는
`wrangler dev` 기동 후 수동 또는 별도 통합 테스트로 확인한다 (아직 없음).

## 배포 전 확인 체크리스트 (RANKING_SERVER_OPTIONS.md §5)

- [ ] `wrangler.toml`의 `database_id`를 실제 원격 D1로 교체
- [ ] `ALLOWED_ORIGINS`를 운영 GitHub Pages 주소로 확정
- [ ] `npm run db:migrate:remote` 실행
- [ ] Cloudflare 대시보드에서 IP 단위 Rate Limiting 규칙 추가
      (이 코드에는 참여자 단위 최소 간격 제한만 있고, IP 단위 제한은
      Cloudflare 측 설정이 필요하다 — API_SPEC §5)
- [ ] `crons` 트리거(탈퇴 유예 정리)가 실제로 등록되는지 배포 후 확인
- [ ] 사용자 승인 후 서버 먼저 배포, 이후 웹앱 API 주소 연결

## 절대 하지 않는 것

- 개인 API 키, 문제 지문/보기/정답/해설, 과목명·단원명을 저장하지 않는다.
- 토큰 원문을 로그에 남기지 않는다 (`console.error`는 에러 메시지만 남긴다).
