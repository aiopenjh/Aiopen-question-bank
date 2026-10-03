// Gemini 실출제 연결 테스트 (Windows 전용)
// ---------------------------------------------------------------
// 실행: D:\ai bank\packages\ai-login-connector 폴더에서
//   node test-gemini-generate.mjs [모델ID]
// 예: node test-gemini-generate.mjs models/gemini-2.5-flash-lite
//
// 주의: start-login-pilot.ps1(시범 서버)가 켜져 있으면 먼저 끄세요.
//       저장소 잠금 때문에 둘이 동시에 열 수 없습니다.
// 출력에는 토큰이 포함되지 않습니다 (계정 이메일·권한·만료시각만 표시).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AIConnector, WindowsEncryptedStore, createGeminiProvider } from './src/index.js';

if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
  throw new Error('이 스크립트는 Windows에서 실행하세요.');
}

const CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const root = process.cwd();

// 1) 설정 파일 (없어도 저장소 진단은 계속한다)
let google = {};
try {
  const config = JSON.parse(await readFile(join(root, '.local', 'config.json'), 'utf8'));
  google = config.google ?? {};
  console.log('1) .local/config.json: 있음');
} catch (e) {
  if (e.code === 'ENOENT') console.log('1) .local/config.json: 없음 → Google 신규 로그인은 현재 불가');
  else throw e;
}
console.log('   clientId:', google.clientId ? '(설정됨)' : '(없음)');
console.log('   projectId:', google.projectId ?? '(없음)');
console.log('   apiAccess:', google.apiAccess === true);
console.log();

const store = new WindowsEncryptedStore(join(process.env.LOCALAPPDATA, 'AI_Login_Connector', 'credentials.enc'));
const connector = new AIConnector({ store, providers: [createGeminiProvider(google)] });
try {
  // 2) 저장된 로그인 기록 (토큰 제외하고 표시)
  const data = await store.read();
  const accounts = Object.values(data.accounts).filter(a => a.provider === 'google');
  console.log(`2) 저장된 Google 계정: ${accounts.length}개`);
  for (const acc of accounts) {
    const { accessToken, refreshToken, idToken, ...safe } = acc;
    console.log('   -', JSON.stringify({
      ...safe,
      expiresAt: safe.expiresAt ? new Date(safe.expiresAt).toLocaleString('ko-KR') : null,
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      hasCloudScope: (safe.scopes ?? []).includes(CLOUD_SCOPE),
    }, null, 4).split('\n').map((l, i) => (i ? '    ' : '   ') + l).join('\n'));
  }
  if (!accounts.length) {
    console.log('   → 로그인 기록이 없습니다. config.json을 만든 뒤 연결 화면에서 Google 로그인을 하세요.');
    process.exit(2);
  }

  const [status] = await connector.status();
  console.log();
  console.log('3) 판정:', status.status, '| AI 사용 가능(canInfer):', status.canInfer);
  if (!status.canInfer) {
    console.log('   → 출제가 안 되는 이유 후보:');
    console.log('     a) apiAccess가 false이거나 projectId가 없음 → config.json 수정');
    console.log('     b) 저장된 토큰에 cloud-platform 스코프가 없음 → apiAccess 켠 "이후에" 다시 로그인');
    console.log('     c) Google Cloud 프로젝트에 "Generative Language API" 미활성화');
    process.exit(3);
  }

  // 4) 모델 목록 + 실출제
  const models = await connector.models('google');
  console.log();
  console.log('4) 모델 목록:', models.length + '개');
  for (const m of models.slice(0, 15)) console.log('   -', m.id);
  if (models.length > 15) console.log(`   ... 외 ${models.length - 15}개`);

  const wanted = process.argv[2];
  const target = (wanted && models.find(m => m.id === wanted || m.id.endsWith('/' + wanted)))
    ?? models.find(m => /flash-lite/i.test(m.id))
    ?? models[0];
  if (!target) { console.log('사용 가능한 모델이 없습니다.'); process.exit(4); }

  console.log();
  console.log('5) 출제 테스트 모델:', target.id);
  console.log('--- 응답 시작 ---');
  const result = await connector.generate('google', {
    model: target.id,
    prompt: '객관식 문제 1개를 만들어줘. 주제: 광합성. 한 줄로 답해줘.',
    onDelta: t => process.stdout.write(t),
  });
  console.log();
  console.log('--- 응답 끝 ---');
  console.log('완료 여부:', result.completed);
} catch (e) {
  console.error('실패:', e.code ?? e.name, '-', e.message);
  process.exitCode = 1;
} finally {
  await connector.close();
}
