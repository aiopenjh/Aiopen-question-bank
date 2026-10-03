export interface ModelChoice { id: string; name: string }
export interface Credentials {
  id?: string; provider?: string; issuer: string; subject: string; clientId: string;
  email?: string; name?: string; accessToken?: string; refreshToken?: string;
  idToken?: string; expiresAt?: number; scopes?: string[];
}
export interface StoredData { hostId: string; accounts: Record<string, Credentials>; active: Record<string, string> }
export interface CredentialStore {
  read(): Promise<StoredData>; write(data: StoredData): Promise<void>; close?(): Promise<void>;
}
export interface AuthTransaction {
  state: string; nonce: string; verifier: string; challenge: string;
  redirectUri: string; provider: string; accountId: string | null; expiresAt: number; epoch: number;
}
export interface ProviderContext {
  fetch: typeof fetch;
  verifier: { validate(token: string, options: { issuer: string | string[]; audience: string; nonce?: string; subject?: string; jwksUri: string }): Promise<Record<string, unknown>> };
  hostId?: string;
}
export interface GenerateRequest {
  model: string; prompt: string; signal?: AbortSignal;
  onDelta?: (text: string) => void | Promise<void>;
}
export interface Generation { text: string; completed: true; model: string }
/** This interface runs in a trusted local backend, never in browser JavaScript. */
export interface ProviderAdapter {
  id: string; name: string; signupUrl: string; authMode: string; ready: boolean; description: string;
  capabilities: { login: boolean; inference: boolean; streaming: boolean }; requiredScopes?: string[];
  begin(transaction: AuthTransaction, account: Credentials | undefined, context: ProviderContext): Promise<string>;
  exchange?(callback: URL, transaction: AuthTransaction, account: Credentials | undefined, context: ProviderContext): Promise<Credentials>;
  refresh?(account: Credentials, context: ProviderContext): Promise<Credentials>;
  revoke?(account: Credentials, context: ProviderContext): Promise<boolean>;
  models?(account: Credentials, context: ProviderContext): Promise<ModelChoice[]>;
  generate?(account: Credentials, request: GenerateRequest, context: ProviderContext): Promise<Generation>;
}
export interface ProviderStatus {
  id: string; name: string; signupUrl: string; description: string; authMode: string;
  capabilities: ProviderAdapter['capabilities'];
  status: 'connecting' | 'unavailable' | 'connected' | 'identity-only' | 'disconnected';
  canConnect: boolean; canInfer: boolean; activeAccountId: string | null;
  accounts: { id: string; label: string; signedIn: boolean }[];
  lastResult: { ok: boolean; message: string; code?: string } | null;
}
export class AIConnector {
  constructor(options: { providers: ProviderAdapter[]; store?: CredentialStore; fetchImpl?: typeof fetch });
  status(): Promise<ProviderStatus[]>;
  connect(id: string, options: { redirectUri: string; accountId?: string | null }): Promise<{ authorizationUrl: string; expiresAt: number }>;
  completeConnect(callbackUri: string): Promise<{ ok: true; message: string }>;
  selectAccount(id: string, accountId: string): Promise<void>;
  models(id: string): Promise<ModelChoice[]>;
  generate(id: string, request: GenerateRequest): Promise<Generation>;
  disconnect(id: string): Promise<{ remoteRevoked: boolean; message: string }>;
  close(): Promise<void>;
}
export class MemoryStore implements CredentialStore {
  read(): Promise<StoredData>; write(data: StoredData): Promise<void>; close(): Promise<void>;
}
export class WindowsEncryptedStore implements CredentialStore {
  constructor(file: string);
  read(): Promise<StoredData>; write(data: StoredData): Promise<void>; close(): Promise<void>;
}
export class ConnectorError extends Error { constructor(code: string, message: string, status?: number); code: string; status: number }
export function createOpenAIProvider(options?: { appName?: string }): ProviderAdapter;
export function createGeminiProvider(options?: { clientId?: string; clientSecret?: string; projectId?: string; apiAccess?: boolean }): ProviderAdapter;
