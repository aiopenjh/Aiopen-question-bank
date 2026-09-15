/**
 * API credential storage boundary.
 *
 * - Web: a non-extractable AES-GCM key and ciphertext are stored in IndexedDB.
 * - Native/Expo Go: the credential is stored in the OS-backed SecureStore
 *   (Android Keystore / iOS Keychain) and is not migrated to another device.
 * - Legacy plaintext / reversible-XOR values are migrated and then removed.
 *
 * API keys must never be copied into the normal app database or backup payload.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const LEGACY_PLAINTEXT_STORAGE_KEY = '@cogniquest:gemini_api_key';
const LEGACY_VAULT_STORAGE_KEY = '@cogniquest:secure_vault_v1';
const LEGACY_SECRET_SALT = 'CQ_SECURE_SALT_2026_V1';

const WEB_VAULT_DATABASE = 'celueste-secure-vault';
const WEB_VAULT_STORE = 'credentials';
const WEB_API_KEY_RECORD = 'ai-api-key';
const WEB_VAULT_VERSION = 1;
const NATIVE_API_KEY_RECORD = 'celueste.ai_api_key.v2';
const NATIVE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type ApiKeyPersistence = 'persistent' | 'session-only';

interface WebApiKeyRecord {
  id: typeof WEB_API_KEY_RECORD;
  version: 2;
  encryptionKey: CryptoKey;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  updatedAt: string;
}

interface LegacyVaultState {
  geminiApiKeyEncrypted?: unknown;
}

let sessionApiKey: string | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function canUseWebCryptoVault(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof indexedDB !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined'
  );
}

function openWebVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WEB_VAULT_DATABASE, WEB_VAULT_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WEB_VAULT_STORE)) {
        database.createObjectStore(WEB_VAULT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('보안 저장소를 열 수 없습니다.'));
    request.onblocked = () => reject(new Error('보안 저장소가 다른 화면에서 사용 중입니다.'));
  });
}

async function readWebRecord(): Promise<WebApiKeyRecord | null> {
  const database = await openWebVault();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(WEB_VAULT_STORE, 'readonly');
      const request = transaction.objectStore(WEB_VAULT_STORE).get(WEB_API_KEY_RECORD);
      request.onsuccess = () => resolve((request.result as WebApiKeyRecord | undefined) ?? null);
      request.onerror = () => reject(new Error('보안 자격 증명을 읽을 수 없습니다.'));
      transaction.onabort = () => reject(new Error('보안 자격 증명 읽기가 중단되었습니다.'));
    });
  } finally {
    database.close();
  }
}

async function writeWebRecord(record: WebApiKeyRecord): Promise<void> {
  const database = await openWebVault();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(WEB_VAULT_STORE, 'readwrite');
      transaction.objectStore(WEB_VAULT_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('보안 자격 증명을 저장할 수 없습니다.'));
      transaction.onabort = () => reject(new Error('보안 자격 증명 저장이 중단되었습니다.'));
    });
  } finally {
    database.close();
  }
}

async function deleteWebRecord(): Promise<void> {
  if (!canUseWebCryptoVault()) return;
  const database = await openWebVault();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(WEB_VAULT_STORE, 'readwrite');
      transaction.objectStore(WEB_VAULT_STORE).delete(WEB_API_KEY_RECORD);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('보안 자격 증명을 삭제할 수 없습니다.'));
      transaction.onabort = () => reject(new Error('보안 자격 증명 삭제가 중단되었습니다.'));
    });
  } finally {
    database.close();
  }
}

async function decryptWebRecord(record: WebApiKeyRecord): Promise<string | null> {
  if (
    record?.id !== WEB_API_KEY_RECORD ||
    record.version !== 2 ||
    !record.encryptionKey ||
    !record.iv ||
    !record.ciphertext
  ) {
    return null;
  }

  try {
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: record.iv },
      record.encryptionKey,
      record.ciphertext
    );
    const key = new TextDecoder().decode(plaintext).trim();
    return key || null;
  } catch {
    return null;
  }
}

async function saveWebKey(key: string): Promise<void> {
  const previousRecord = await readWebRecord();
  const encryptionKey = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const ivBytes = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const iv = ivBytes.buffer as ArrayBuffer;
  const encodedKey = new TextEncoder().encode(key);
  const plaintext = encodedKey.buffer.slice(
    encodedKey.byteOffset,
    encodedKey.byteOffset + encodedKey.byteLength
  ) as ArrayBuffer;
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    plaintext
  );

  const record: WebApiKeyRecord = {
    id: WEB_API_KEY_RECORD,
    version: 2,
    encryptionKey,
    iv,
    ciphertext,
    updatedAt: new Date().toISOString(),
  };

  await writeWebRecord(record);
  const saved = await readWebRecord();
  const verified = saved ? await decryptWebRecord(saved) : null;
  if (verified !== key) {
    if (previousRecord) {
      await writeWebRecord(previousRecord);
    } else {
      await deleteWebRecord();
    }
    throw new Error('보안 자격 증명 저장을 확인할 수 없습니다.');
  }
}

async function canUseNativeSecureStore(): Promise<boolean> {
  return Platform.OS !== 'web' && SecureStore.isAvailableAsync();
}

async function saveNativeKey(key: string): Promise<void> {
  if (!(await canUseNativeSecureStore())) {
    throw new Error('이 기기에서는 보안 자격 증명 저장소를 사용할 수 없습니다.');
  }

  const previousValue = await SecureStore.getItemAsync(
    NATIVE_API_KEY_RECORD,
    NATIVE_STORE_OPTIONS
  );

  await SecureStore.setItemAsync(NATIVE_API_KEY_RECORD, key, NATIVE_STORE_OPTIONS);
  const verified = await SecureStore.getItemAsync(
    NATIVE_API_KEY_RECORD,
    NATIVE_STORE_OPTIONS
  );

  if (verified !== key) {
    if (previousValue) {
      await SecureStore.setItemAsync(
        NATIVE_API_KEY_RECORD,
        previousValue,
        NATIVE_STORE_OPTIONS
      );
    } else {
      await SecureStore.deleteItemAsync(NATIVE_API_KEY_RECORD, NATIVE_STORE_OPTIONS);
    }
    throw new Error('보안 자격 증명 저장을 확인할 수 없습니다.');
  }
}

/** Decode only the previous vault format so it can be removed after migration. */
function decryptLegacyWeakValue(encryptedHex: string): string | null {
  if (!encryptedHex || encryptedHex.length % 4 !== 0 || !/^[0-9a-f]+$/i.test(encryptedHex)) {
    return null;
  }

  try {
    let decoded = '';
    for (let offset = 0, index = 0; offset < encryptedHex.length; offset += 4, index += 1) {
      const encodedCode = Number.parseInt(encryptedHex.slice(offset, offset + 4), 16);
      const originalCode =
        encodedCode ^
        (LEGACY_SECRET_SALT.charCodeAt(index % LEGACY_SECRET_SALT.length) + (index % 7));
      decoded += String.fromCharCode(originalCode);
    }

    const prefix = `${LEGACY_SECRET_SALT}:`;
    if (!decoded.startsWith(prefix)) return null;
    const value = decoded.slice(prefix.length).trim();
    return value || null;
  } catch {
    return null;
  }
}

async function readLegacyKey(): Promise<string | null> {
  const [legacyVaultRaw, legacyPlaintext] = await Promise.all([
    AsyncStorage.getItem(LEGACY_VAULT_STORAGE_KEY),
    AsyncStorage.getItem(LEGACY_PLAINTEXT_STORAGE_KEY),
  ]);

  if (legacyVaultRaw) {
    try {
      const parsed = JSON.parse(legacyVaultRaw) as LegacyVaultState;
      if (typeof parsed.geminiApiKeyEncrypted === 'string') {
        const decrypted = decryptLegacyWeakValue(parsed.geminiApiKeyEncrypted);
        if (decrypted) return decrypted;
      }
    } catch {
      // Invalid legacy data is ignored and removed by the migration boundary.
    }
  }

  const trimmedPlaintext = legacyPlaintext?.trim();
  return trimmedPlaintext || null;
}

async function removeLegacyStorage(): Promise<void> {
  await AsyncStorage.multiRemove([LEGACY_PLAINTEXT_STORAGE_KEY, LEGACY_VAULT_STORAGE_KEY]);
}

async function saveInternal(key: string): Promise<ApiKeyPersistence> {
  if (Platform.OS === 'web') {
    if (!canUseWebCryptoVault()) {
      throw new Error('브라우저 보안 저장소를 사용할 수 없습니다.');
    }
    await saveWebKey(key);
  } else {
    await saveNativeKey(key);
  }

  sessionApiKey = key;
  await removeLegacyStorage();
  return 'persistent';
}

async function getInternal(): Promise<string | null> {
  if (sessionApiKey) return sessionApiKey;

  if (Platform.OS === 'web' && canUseWebCryptoVault()) {
    const record = await readWebRecord();
    if (record) {
      const decrypted = await decryptWebRecord(record);
      if (decrypted) {
        sessionApiKey = decrypted;
        return decrypted;
      }
    }
  } else if (await canUseNativeSecureStore()) {
    const savedKey = (
      await SecureStore.getItemAsync(NATIVE_API_KEY_RECORD, NATIVE_STORE_OPTIONS)
    )?.trim();
    if (savedKey) {
      sessionApiKey = savedKey;
      return savedKey;
    }
  }

  const legacyKey = await readLegacyKey();
  if (!legacyKey) {
    await removeLegacyStorage();
    return null;
  }

  await saveInternal(legacyKey);
  return legacyKey;
}

/**
 * Store an API key without ever placing its plaintext in AsyncStorage.
 * Returns whether it will survive an app/browser restart.
 */
export async function saveEncryptedApiKey(key: string): Promise<ApiKeyPersistence> {
  const trimmed = key.trim();
  if (!trimmed) {
    await deleteEncryptedApiKey();
    return 'persistent';
  }
  return enqueue(() => saveInternal(trimmed));
}

/** Load the API key into memory only when the caller needs it. */
export async function getEncryptedApiKey(): Promise<string | null> {
  return enqueue(getInternal);
}

/** Check presence without logging or serializing the credential. */
export async function hasValidApiKey(): Promise<boolean> {
  const key = await getEncryptedApiKey();
  return typeof key === 'string' && key.length > 8;
}

/** Remove both the current secure record and every legacy representation. */
export async function deleteEncryptedApiKey(): Promise<void> {
  return enqueue(async () => {
    sessionApiKey = null;
    if (Platform.OS === 'web') {
      await deleteWebRecord();
    } else if (await canUseNativeSecureStore()) {
      await SecureStore.deleteItemAsync(NATIVE_API_KEY_RECORD, NATIVE_STORE_OPTIONS);
    }
    await removeLegacyStorage();
  });
}
