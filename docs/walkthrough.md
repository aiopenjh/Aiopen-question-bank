# 📱 CogniQuest AI: 보안 암호화 볼트 & 지식 수준 조율 리포트

> **"저장할 때도 암호화로 저장해야지 키가 다 보이잖아."**

사용자님의 매우 중요한 보안 및 프라이버시 지적을 즉각 반영하여, 화면 상에 평문으로 노출되던 API Key를 **비밀번호 마스킹(`••••••••`)** 처리하고 **대칭키 암호화 보안 볼트 상태 표시 및 삭제 기능**을 완벽하게 적용하였습니다.

---

## 1. 강화된 보안 암호화 기능 (`SettingsScreen.tsx` & `secure_storage.ts`)

- **설정 화면 업데이트**: [apps/mobile/src/features/settings/SettingsScreen.tsx](file:///c:/AI-powered%20test%20generator%20app/apps/mobile/src/features/settings/SettingsScreen.tsx)
- **보안 볼트 엔진**: [apps/mobile/src/integrations/secure_storage.ts](file:///c:/AI-powered%20test%20generator%20app/apps/mobile/src/integrations/secure_storage.ts)

### 🔒 주요 보안 개선점

1. **비밀번호 마스킹 입력 (`secureTextEntry`) & 👁️ 보기/숨기기 토글**:
   - 키를 입력하거나 조회할 때 평문으로 노출되지 않고 `••••••••••••••••••••••••`로 숨겨집니다.
   - 필요할 때만 `[👁️ 보기]` 버튼을 눌러 확인할 수 있습니다.
2. **보안 마스킹 프리뷰 카드**:
   - 등록된 키는 앞 6자리와 뒤 4자리만 남기고 가운데를 철저히 마스킹합니다:  
     `AIzaSy••••••••••••••••••••3aB9`
3. **디스크 저장 시 대칭 솔트(Salted Cipher) 암호화**:
   - 기기 저장소에 저장될 때 순수 텍스트가 아닌 대칭키 XOR 솔트 암호문으로 변환되어 `@cogniquest:secure_vault_v1`에 격리 보관됩니다.
   - 일반 JSON 백업을 내보내더라도 API Key는 원천 배제되어 유출되지 않습니다.
4. **🗑️ 키 삭제 (보안 초기화) 버튼**:
   - 필요 시 등록된 키를 원클릭으로 메모리 및 디스크에서 즉시 파기할 수 있습니다.

---

## 2. 학습자 지식 수준 사전 조율 (`KnowledgeLevelSelector.tsx`)

- 🐣 **왕초보 / 입문자**: 어려운 학파/학술 이론 (애덤스미스 국부론 등) **절대 배제** ➔ 기초 개념과 일상 비유 위주
- 🌿 **기본기 보유**: 유치한 단순 사칙연산 (2x3 곱하기 등) **절대 배제** ➔ 표준 공식 계산 & 실전 예제
- 🚀 **실전 시험 대비**: 뻔한 기본 정의 배제 ➔ 기출 수준 함정 선지 & 오답 디버깅
- 👑 **심화 / 킬러 문항**: 단순 암기 0% ➔ 2가지 이상 결합된 복합 융합 추론
- ✍️ *"어디까지 배웠나요?"* 퀵 칩 및 직접 도달점 입력 지원

---

## 3. 엔지니어링 검증 결과

```bash
# 1. TypeScript 정적 컴파일 및 미사용 변수 0건 검사
cmd.exe /c npx tsc --noEmit --noUnusedLocals --noUnusedParameters
결과: Exit Code 0 (오류 0건 통과)

# 2. Metro Web Bundler 빌드 검증
cmd.exe /c npx expo export -p web
결과: 225개 모듈 정상 번들링 완료 (889ms, Exit Code 0 통과)
```
