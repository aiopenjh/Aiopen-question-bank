// Study material file picking: Android reads the picker's original URI with the new File API
// (no cache copy, no legacy readAsStringAsync). The web keeps using the browser File object.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PDFDocument } = require('pdf-lib');
const { zipSync, strToU8 } = require('fflate');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

function loadSourceManager({ platform = 'android', asset, nativeFile }) {
  const alerts = [];
  const pickerOptions = [];
  const nativeReads = [];
  const stateLog = [];
  const digestInputs = [];
  const cache = new Map();

  class FakeExpoFile {
    constructor(uri) { this.uri = uri; }
    async bytes() { nativeReads.push(['bytes', this.uri]); return nativeFile.bytes; }
    async text() { nativeReads.push(['text', this.uri]); return nativeFile.text; }
  }
  const react = {
    useState(initial) {
      const slot = { value: initial };
      stateLog.push(slot);
      return [initial, next => { slot.value = next; }];
    },
  };

  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console: { warn() {}, log() {}, error() {} }, Promise, Uint8Array, Math, JSON, Date, Array, Object, Map, Set, Error,
      globalThis: {},
    }, { filename: file })(name => {
      if (name === 'react') return react;
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === 'expo-file-system') return { File: FakeExpoFile };
      if (name === 'expo-crypto') {
        return {
          CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
          digest: async (algorithm, data) => {
            if (algorithm !== 'SHA-256') throw new Error(`Unexpected digest ${algorithm}`);
            digestInputs.push(data);
            const hash = createHash('sha256').update(data).digest();
            return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
          },
        };
      }
      if (name === 'expo-file-system/legacy') throw new Error('legacy FileSystem must not be used for study materials');
      if (name === 'expo-document-picker') {
        return { getDocumentAsync: async options => { pickerOptions.push(options); return { canceled: false, assets: [asset] }; } };
      }
      if (name === 'pdf-lib/dist/pdf-lib.esm.js') return require('pdf-lib');
      if (name === 'fflate') return require('fflate');
      if (name === '../data/db') return {};
      if (name === '../utils/alert') return { showAlert: (title, message) => alerts.push([title, message]) };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw new Error(`Unexpected dependency ${name}`);
    }, module, module.exports);
    return module.exports;
  }

  const { useSourceManager } = load(path.join(ROOT, 'src/hooks/useSourceManager.ts'));
  const manager = useSourceManager({ topics: [], setSources() {} });
  return { manager, alerts, pickerOptions, nativeReads, stateLog, digestInputs };
}

async function makePdf(pageCount, padBytes = 0) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) pdf.addPage([200, 200]);
  if (padBytes > 0) {
    const pad = new Uint8Array(padBytes); // 압축되지 않는 의사 난수(스캔 이미지 대용)
    let seed = 0x9e3779b9;
    for (let index = 0; index < pad.length; index += 1) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      pad[index] = seed & 0xff;
    }
    await pdf.attach(pad, 'scan.bin', { mimeType: 'application/octet-stream' });
  }
  return pdf.save({ useObjectStreams: false });
}

test('Android PDF is read from the original content URI with File.bytes() and its pages are counted', async () => {
  const bytes = await makePdf(12, 13 * 1024 * 1024); // 약 13MB PDF
  assert.ok(bytes.byteLength > 13 * 1024 * 1024);
  const uri = 'content://com.android.providers.downloads.documents/document/42';
  const { manager, alerts, pickerOptions, nativeReads } = loadSourceManager({
    asset: { uri, name: '회계원리.pdf' },
    nativeFile: { bytes },
  });
  await manager.handlePickSourceFile();
  assert.equal(pickerOptions[0].copyToCacheDirectory, false);
  assert.deepEqual(nativeReads, [['bytes', uri]]);
  assert.equal(alerts.at(-1)[0], 'PDF 불러오기 완료');
  assert.match(alerts.at(-1)[1], /총 12페이지/);
});

test('iOS keeps the cache copy so the picked file can be read immediately', async () => {
  const bytes = await makePdf(4);
  const uri = 'file:///var/mobile/Containers/Data/Application/cache/DocumentPicker/book.pdf';
  const { manager, alerts, pickerOptions, nativeReads } = loadSourceManager({
    platform: 'ios',
    asset: { uri, name: 'book.pdf' },
    nativeFile: { bytes },
  });
  await manager.handlePickSourceFile();
  assert.equal(pickerOptions[0].copyToCacheDirectory, true);
  assert.deepEqual(nativeReads, [['bytes', uri]]);
  assert.match(alerts.at(-1)[1], /총 4페이지/);
});

test('Android text and ZIP materials use File.text() and File.bytes()', async () => {
  const text = loadSourceManager({
    asset: { uri: 'content://docs/1', name: 'notes.md' },
    nativeFile: { text: '# 1장 차변과 대변' },
  });
  await text.manager.handlePickSourceFile();
  assert.deepEqual(text.nativeReads, [['text', 'content://docs/1']]);
  assert.ok(text.stateLog.some(slot => slot.value === '# 1장 차변과 대변'));

  const zip = zipSync({ 'chapter1.txt': strToU8('ZIP교재 1장'), 'cover.png': new Uint8Array([1, 2, 3]) });
  const archive = loadSourceManager({
    asset: { uri: 'content://docs/2', name: 'book.zip' },
    nativeFile: { bytes: zip },
  });
  await archive.manager.handlePickSourceFile();
  assert.deepEqual(archive.nativeReads, [['bytes', 'content://docs/2']]);
  const extracted = archive.stateLog.find(slot => typeof slot.value === 'string' && slot.value.includes('ZIP교재 1장'));
  assert.ok(extracted && extracted.value.includes('[chapter1.txt]') && !extracted.value.includes('cover.png'));
});

test('web keeps reading the browser File object and never touches the native file API', async () => {
  const bytes = await makePdf(3);
  const browserFile = {
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => 'unused',
  };
  const { manager, alerts, nativeReads, pickerOptions } = loadSourceManager({
    platform: 'web',
    asset: { uri: 'blob:http://localhost/1', name: 'web.pdf', file: browserFile },
    nativeFile: {},
  });
  await manager.handlePickSourceFile();
  assert.equal(pickerOptions[0].copyToCacheDirectory, true); // 수정 전과 같은 값
  assert.deepEqual(nativeReads, []);
  assert.match(alerts.at(-1)[1], /총 3페이지/);
});

test('Android, iOS and web produce the same full-file SHA-256 fingerprint for the same PDF', async () => {
  const bytes = await makePdf(2, 64 * 1024);
  const expected = createHash('sha256').update(bytes).digest('hex');
  const fingerprintOf = async (platform, asset) => {
    const { manager, stateLog, digestInputs } = loadSourceManager({ platform, asset, nativeFile: { bytes } });
    await manager.handlePickSourceFile();
    // 대용량 PDF를 해시 전에 다시 복사하지 않는다(네이티브는 읽은 배열을 그대로 넘긴다).
    if (platform !== 'web') assert.equal(digestInputs[0], bytes);
    return stateLog.find(slot => slot.value && typeof slot.value.fingerprint === 'string').value.fingerprint;
  };
  const browserFile = {
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => 'unused',
  };
  assert.equal(await fingerprintOf('android', { uri: 'content://docs/9', name: 'a.pdf' }), expected);
  assert.equal(await fingerprintOf('ios', { uri: 'file:///cache/a.pdf', name: 'a.pdf' }), expected);
  assert.equal(await fingerprintOf('web', { uri: 'blob:x', name: 'a.pdf', file: browserFile }), expected);
});
