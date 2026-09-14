/**
 * Secure Storage & Encryption Layer
 * 
 * 목적: API Key 등 민감한 자격 증명을 일반 DB 및 백업 JSON과 격리하여 암호화 보관
 * 참조: CogniQuest_개발명세_v1/01_제품요구사항.md R12 & 02_구조와기술결정.md
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const VAULT_STORAGE_KEY = '@cogniquest:secure_vault_v1';
const SECRET_SALT = 'CQ_SECURE_SALT_2026_V1';

/**
 * 대칭형 시프트 & 솔트 암호화 함수
 * (민감 정보가 평문으로 노출되거나 디스크/로그에 직접 노출되는 것을 방지)
 */
function encryptValue(text: string): string {
  if (!text) return '';
  const salted = `${SECRET_SALT}:${text}`;
  const charCodes: number[] = [];
  for (let i = 0; i < salted.length; i++) {
    const code = salted.charCodeAt(i) ^ (SECRET_SALT.charCodeAt(i % SECRET_SALT.length) + (i % 7));
    charCodes.push(code);
  }
  return charCodes.map((c) => c.toString(16).padStart(4, '0')).join('');
}

/**
 * 대칭형 복호화 함수
 */
function decryptValue(encryptedHex: string): string {
  if (!encryptedHex) return '';
  try {
    const charCodes: number[] = [];
    for (let i = 0; i < encryptedHex.length; i += 4) {
      const hexChunk = encryptedHex.slice(i, i + 4);
      charCodes.push(parseInt(hexChunk, 16));
    }

    let decoded = '';
    for (let i = 0; i < charCodes.length; i++) {
      const originalCode = charCodes[i] ^ (SECRET_SALT.charCodeAt(i % SECRET_SALT.length) + (i % 7));
      decoded += String.fromCharCode(originalCode);
    }

    const prefix = `${SECRET_SALT}:`;
    if (decoded.startsWith(prefix)) {
      return decoded.slice(prefix.length);
    }
    return '';
  } catch (err) {
    console.error('보안 자격증명 복호화 실패:', err);
    return '';
  }
}

interface SecureVaultState {
  geminiApiKeyEncrypted: string | null;
  lastUpdated: string;
}

async function loadVault(): Promise<SecureVaultState> {
  const raw = await AsyncStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) {
    return {
      geminiApiKeyEncrypted: null,
      lastUpdated: new Date().toISOString(),
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      geminiApiKeyEncrypted: null,
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function saveVault(vault: SecureVaultState): Promise<void> {
  vault.lastUpdated = new Date().toISOString();
  await AsyncStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
}

// -------------------------------------------------------------
// Public Secure Secrets APIs
// -------------------------------------------------------------

/**
 * Gemini API Key를 암호화하여 보안 볼트에 안전하게 저장
 */
export async function saveEncryptedApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  const vault = await loadVault();
  if (!trimmed) {
    vault.geminiApiKeyEncrypted = null;
  } else {
    vault.geminiApiKeyEncrypted = encryptValue(trimmed);
  }
  await saveVault(vault);
}

/**
 * 보안 볼트에서 복호화된 API Key 조회 (실제 통신 직전에만 메모리로 로드)
 */
export async function getEncryptedApiKey(): Promise<string | null> {
  const vault = await loadVault();
  if (!vault.geminiApiKeyEncrypted) {
    return null;
  }
  const decrypted = decryptValue(vault.geminiApiKeyEncrypted);
  return decrypted.length > 0 ? decrypted : null;
}

/**
 * 유효한 API Key가 존재하는지 확인 (평문 노출 없이 존재 여부만 반환)
 */
export async function hasValidApiKey(): Promise<boolean> {
  const key = await getEncryptedApiKey();
  return typeof key === 'string' && key.length > 8;
}

/**
 * API Key 삭제 (로그아웃 또는 연결 해제 시)
 */
export async function deleteEncryptedApiKey(): Promise<void> {
  const vault = await loadVault();
  vault.geminiApiKeyEncrypted = null;
  await saveVault(vault);
}
