-- 초고난도 도전 랭킹 (PRODUCT_ROADMAP_AND_BETA_PLAN.md §Step 1)
-- 정답 처리된 문제 중 difficultyLevel >= 31(킬러 문항)의 전체 기간 최고 도달 레벨.
-- best_streak과 동일하게 단조 증가값(MAX)만 저장한다.

ALTER TABLE participant_stats ADD COLUMN max_killer_level INTEGER NOT NULL DEFAULT 0;
