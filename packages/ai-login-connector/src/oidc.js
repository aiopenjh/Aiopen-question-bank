import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';
import { ConnectorError, fetchJson } from './errors.js';

export const randomValue = () => randomBytes(32).toString('base64url');
export const challengeFor = value => createHash('sha256').update(value).digest('base64url');
export function sameSecret(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class IdentityVerifier {
  constructor(fetchImpl) { this.fetch = fetchImpl; this.keys = new Map(); }

  async validate(token, { issuer, audience, nonce, subject, jwksUri }) {
    const fail = () => { throw new ConnectorError('IDENTITY_INVALID', '로그인 응답의 신원을 검증하지 못했습니다.', 401); };
    if (typeof token !== 'string' || token.length > 32_768) fail();
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) fail();
    let header, claims;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
    } catch { fail(); }
    if (header?.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit !== undefined) fail();
    // The key URL is trusted provider configuration, never a JWT jku/x5u value.
    let cached = this.keys.get(jwksUri);
    if (!cached || cached.expires <= Date.now() || !cached.keys.some(key => key.kid === header.kid)) {
      const data = await fetchJson(this.fetch, jwksUri);
      if (!Array.isArray(data.keys)) fail();
      cached = { keys: data.keys, expires: Date.now() + 300_000 };
      this.keys.set(jwksUri, cached);
    }
    const key = cached.keys.find(item => item.kid === header.kid && item.kty === 'RSA'
      && (!item.alg || item.alg === 'RS256') && (!item.use || item.use === 'sig')
      && (!item.key_ops || item.key_ops.includes('verify')));
    if (!key) fail();
    try {
      if (!verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`),
        createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) fail();
    } catch { fail(); }
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const issuers = Array.isArray(issuer) ? issuer : [issuer];
    if (!issuers.includes(claims.iss) || !audiences.includes(audience)
      || (audiences.length > 1 && claims.azp !== audience)
      || !Number.isInteger(claims.exp) || claims.exp <= now - 5
      || !Number.isInteger(claims.iat) || claims.iat > now + 5
      || (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now + 5))
      || typeof claims.sub !== 'string' || !claims.sub
      || (nonce !== undefined && !sameSecret(claims.nonce, nonce))
      || (subject !== undefined && claims.sub !== subject)) fail();
    return claims;
  }
}
