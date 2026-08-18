import type { AsymmetricJwtAlgorithm } from '../../src/identity/keys.js';

/** Generate a key pair and return PKCS#8 / SPKI PEMs, as a deployment would hold. */
export async function generatePemPair(
  alg: AsymmetricJwtAlgorithm
): Promise<{ privatePem: string; publicPem: string }> {
  const params =
    alg === 'RS256'
      ? {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        }
      : { name: 'Ed25519' };
  const pair = (await crypto.subtle.generateKey(params as AlgorithmIdentifier, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const toPem = async (format: 'pkcs8' | 'spki', key: CryptoKey, label: string) => {
    const b64 = Buffer.from(await crypto.subtle.exportKey(format, key)).toString('base64');
    return `-----BEGIN ${label} KEY-----\n${b64.replace(/(.{64})/g, '$1\n')}\n-----END ${label} KEY-----\n`;
  };
  return {
    privatePem: await toPem('pkcs8', pair.privateKey, 'PRIVATE'),
    publicPem: await toPem('spki', pair.publicKey, 'PUBLIC'),
  };
}
