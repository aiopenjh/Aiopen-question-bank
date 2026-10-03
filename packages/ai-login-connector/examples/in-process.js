// This example only reads local state. It never starts login or inference.
import { AIConnector, MemoryStore, createOpenAIProvider, createGeminiProvider } from '../src/index.js';

const connector = new AIConnector({
  store: new MemoryStore(),
  providers: [createOpenAIProvider({ appName: 'My Learning App' }), createGeminiProvider()],
});

try {
  console.log(await connector.status());
  // Host your loopback listener before connect(). Open authorizationUrl in the
  // system browser; pass its callback URL to completeConnect() on this backend.
  // const login = await connector.connect('openai', { redirectUri: 'http://127.0.0.1:49152/auth/callback' });
  // const models = await connector.models('openai');
  // const answer = await connector.generate('openai', { model: models[0].id, prompt: '학습 문제를 한 개 만들어줘.' });
} finally { await connector.close(); }
