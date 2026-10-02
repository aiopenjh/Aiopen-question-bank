import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { ConnectorError } from './errors.js';

const clone = value => structuredClone(value);
export class MemoryStore {
  constructor() { this.data = { hostId: `urn:uuid:${randomUUID()}`, accounts: {}, active: {} }; }
  async read() { return clone(this.data); }
  async write(data) { this.data = clone(data); }
  async close() {}
}

function dpapi(value, operation) {
  if (process.platform !== 'win32') throw new ConnectorError('WINDOWS_REQUIRED', '이 저장소는 Windows 전용입니다. 다른 환경에서는 보호된 저장소를 주입하세요.');
  const verb = operation === 'encrypt' ? 'Protect' : 'Unprotect';
  const script = `Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::${verb}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`;
  return new Promise((resolveValue, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    const timeout = setTimeout(() => { child.kill(); reject(new ConnectorError('STORE_FAILED', 'Windows 자격 증명 보호 작업이 시간 제한을 넘었습니다.')); }, 15_000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; });
    // Neither plaintext tokens nor PowerShell diagnostics are logged.
    child.stderr.resume();
    child.once('error', () => { clearTimeout(timeout); reject(new ConnectorError('STORE_FAILED', 'Windows 자격 증명 보호 기능을 실행하지 못했습니다.')); });
    child.once('close', code => {
      clearTimeout(timeout);
      if (code !== 0 || !/^[A-Za-z0-9+/=]+$/.test(output)) return reject(new ConnectorError('STORE_FAILED', '보호된 저장소를 처리하지 못했습니다.'));
      resolveValue(Buffer.from(output, 'base64'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(Buffer.from(value).toString('base64'));
  });
}

export class WindowsEncryptedStore {
  constructor(file) { this.file = resolve(file); this.data = null; this.lock = null; this.queue = Promise.resolve(); this.initializing = null; }
  async initialize() {
    if (this.data) return;
    if (!this.initializing) this.initializing = this.open();
    return this.initializing;
  }
  async open() {
    const id = createHash('sha256').update(this.file.toLowerCase()).digest('hex').slice(0, 32);
    this.lock = createServer(socket => socket.end());
    await new Promise((done, reject) => {
      this.lock.once('error', () => reject(new ConnectorError('STORE_IN_USE', '같은 저장소를 사용하는 연결 프로그램을 먼저 종료하세요.')));
      this.lock.listen(`\\\\.\\pipe\\ai-login-connector-${id}`, done);
    });
    try {
      let data;
      try {
        const encrypted = await readFile(this.file);
        data = JSON.parse((await dpapi(encrypted, 'decrypt')).toString('utf8'));
      } catch (error) {
        if (error.code !== 'ENOENT') throw new ConnectorError('STORE_FAILED', '기존 저장소를 읽지 못했습니다. 덮어쓰지 않았습니다.');
        data = { hostId: `urn:uuid:${randomUUID()}`, accounts: {}, active: {} };
      }
      if (typeof data.hostId !== 'string' || !data.accounts || !data.active) throw new ConnectorError('STORE_FAILED', '저장소 형식이 올바르지 않습니다.');
      this.data = data;
      // Persist the host ID before the first authorization attempt.
      await this.persist(data);
    } catch (error) { await this.close(); throw error; }
  }
  async read() { await this.initialize(); await this.queue; return clone(this.data); }
  async persist(data) {
    await mkdir(dirname(this.file), { recursive: true });
    const encrypted = await dpapi(Buffer.from(JSON.stringify(data)), 'encrypt');
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, encrypted, { mode: 0o600, flag: 'wx' });
    await rename(temporary, this.file);
  }
  async write(data) {
    await this.initialize();
    const snapshot = clone(data);
    const operation = this.queue.then(async () => { await this.persist(snapshot); this.data = snapshot; });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async close() {
    await this.queue;
    if (this.lock?.listening) await new Promise(done => this.lock.close(done));
    this.lock = null;
  }
}
