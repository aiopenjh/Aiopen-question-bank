import { LogBox } from 'react-native';
import { AppView } from './src/components/AppView';
import { useAppController } from './src/hooks/useAppController';
import { isRankingWindow } from './src/features/ranking/openRankingWindow';
import { RankingWindowScreen } from './src/features/ranking/RankingWindowScreen';

LogBox.ignoreAllLogs(true);

// 진입 시점에 한 번만 판별한다. 랭킹 전용 창에서는 학습 화면 컨트롤러를
// 아예 마운트하지 않으므로 기존 앱 동작과 완전히 분리된다.
const RANKING_WINDOW = isRankingWindow();

function MainApp() {
  const controller = useAppController();
  return <AppView controller={controller} />;
}

export default function App() {
  if (RANKING_WINDOW) return <RankingWindowScreen />;
  return <MainApp />;
}
