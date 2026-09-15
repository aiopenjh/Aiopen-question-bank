import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { APP_BUILD_INFO } from '../constants/buildInfo';
import { showAlert } from '../utils/alert';

export interface AppUpdateState {
  hasUpdate: boolean;
  isChecking: boolean;
  latestVersion?: string;
  latestBuildTime?: string;
  checkForUpdate: (manual?: boolean) => Promise<void>;
  applyUpdate: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | undefined>();
  const [latestBuildTime, setLatestBuildTime] = useState<string | undefined>();
  const checkingRef = useRef(false);

  const applyUpdate = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      } catch (err) {
        console.warn('Cache clear error:', err);
      }
      // Force reload ignoring cache
      window.location.reload();
    }
  }, []);

  const checkForUpdate = useCallback(async (manual: boolean = false) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      if (manual) {
        showAlert('버전 안내', `현재 최신 버전(${APP_BUILD_INFO.buildLabel})입니다.`);
      }
      return;
    }

    if (checkingRef.current) return;
    checkingRef.current = true;
    setIsChecking(true);

    try {
      // Determine relative or absolute path based on GitHub Pages subpath
      const pathname = window.location.pathname;
      const baseUrl = pathname.includes('/Aiopen-question-bank')
        ? '/Aiopen-question-bank'
        : '';
      const targetUrl = `${baseUrl}/version.json?_t=${Date.now()}`;

      const res = await fetch(targetUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      if (!res.ok) {
        if (manual) {
          showAlert('버전 확인', `현재 버전(${APP_BUILD_INFO.buildLabel})을 정상 사용 중입니다.`);
        }
        return;
      }

      const remoteData = await res.json();
      const remoteBuildTime = remoteData?.buildTime;
      const remoteVer = remoteData?.version || '새 버전';

      if (remoteBuildTime && remoteBuildTime !== APP_BUILD_INFO.buildTime) {
        setHasUpdate(true);
        setLatestVersion(remoteVer);
        setLatestBuildTime(remoteBuildTime);

        if (manual) {
          showAlert(
            '🎉 새 업데이트 발견!',
            `새로운 버전(${remoteVer})이 배포되었습니다.\n지금 1초 만에 최신 기능으로 갱신하시겠습니까?`,
            [
              { text: '나중에', style: 'cancel' },
              {
                text: '지금 갱신 ⚡',
                onPress: applyUpdate,
              },
            ]
          );
        }
      } else {
        setHasUpdate(false);
        if (manual) {
          showAlert(
            '최신 상태',
            `현재 이미 가장 최신 버전(${APP_BUILD_INFO.buildLabel})입니다. ✨`
          );
        }
      }
    } catch (err) {
      console.warn('Check update failed:', err);
      if (manual) {
        showAlert('알림', `현재 최신 버전(${APP_BUILD_INFO.buildLabel})입니다.`);
      }
    } finally {
      checkingRef.current = false;
      setIsChecking(false);
    }
  }, [applyUpdate]);

  useEffect(() => {
    // Check 2 seconds after initial render
    const initialTimer = setTimeout(() => {
      checkForUpdate(false);
    }, 2000);

    // Periodically check every 45 seconds
    const intervalTimer = setInterval(() => {
      checkForUpdate(false);
    }, 45000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [checkForUpdate]);

  return {
    hasUpdate,
    isChecking,
    latestVersion,
    latestBuildTime,
    checkForUpdate,
    applyUpdate,
  };
}
