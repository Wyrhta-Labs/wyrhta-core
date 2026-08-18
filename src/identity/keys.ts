/**
 * Asymmetric JWT key material: loading, public-key derivation, and JWKS
 * document construction.
 *
 * Core never reads env or files — the caller supplies the key material as a
 * string (PEM or JWK JSON) or as a parsed JWK object, exactly as it supplies
 * every other secret today. Core also never serves HTTP: `toJwks` builds the
 * document, the consuming service exposes it.
 */
import { webcrypto } from 'crypto';

/** A JWK as WebCrypto exchanges it. */
export type JsonWebKey = webcrypto.JsonWebKey;

/** Asymmetric algorithms core supports for member tokens. */
export type AsymmetricJwtAlgorithm = 'RS256' | 'EdDSA';

/** Every algorithm `signToken` / `verifyToken` accept. */
export type JwtAlgorithm = 'HS256' | AsymmetricJwtAlgorithm;

/** A JWK plus the `alg`/`kid` the signer stamps into the JWT header. */
export type KeyJwk = JsonWebKey & { alg: AsymmetricJwtAlgorithm; kid: string };

/** A private key usable for signing. Never leaves the issuing service. */
export interface PrivateSigningKey {
  kid: string;
  alg: AsymmetricJwtAlgorithm;
  /** Private JWK; `alg`/`kid` are stamped so the signer writes both. */
  jwk: KeyJwk;
}

/** A public key usable for verification only — structurally cannot sign. */
export interface PublicVerificationKey {
  kid: string;
  alg: AsymmetricJwtAlgorithm;
  /** Public JWK: only the public members, plus `alg`/`kid`. */
  jwk: KeyJwk;
}

/** One entry of a JWKS document. */
export interface JwksKey extends KeyJwk {
  use: 'sig';
}

/** A JWKS document as served at e.g. `/.well-known/jwks.json`. */
export interface JwksDocument {
  keys: JwksKey[];
}

export interface KeyLoadOptions {
  /** Key id stamped into signed tokens and used to select a verification key. */
  kid: string;
  alg: AsymmetricJwtAlgorithm;
}

/** WebCrypto import parameters for an algorithm. */
function subtleAlgorithm(
  alg: AsymmetricJwtAlgorithm
): webcrypto.AlgorithmIdentifier | webcrypto.RsaHashedImportParams {
  return alg === 'RS256'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } }
    : { name: 'Ed25519' };
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem.replace(/-+(BEGIN|END)[^-]*-+/g, '').replace(/\s+/g, '');
  return Uint8Array.from(Buffer.from(body, 'base64'));
}

/**
 * Strip WebCrypto bookkeeping members. `key_ops` / `ext` come back from
 * `exportKey('jwk')` and make a re-import fail when the requested usage does
 * not match, so they are never carried along.
 */
function stripJwk(jwk: JsonWebKey): JsonWebKey {
  const {
    key_ops: _keyOps,
    ext: _ext,
    use: _use,
    alg: _alg,
    kid: _kid,
    ...rest
  } = jwk as JsonWebKey & { kid?: string };
  return rest;
}

function assertShape(jwk: JsonWebKey, alg: AsymmetricJwtAlgorithm, wantPrivate: boolean): void {
  const hasPrivate = typeof jwk.d === 'string' && jwk.d.length > 0;
  if (alg === 'RS256') {
    if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) throw new Error('INVALID_KEY_MATERIAL');
  } else {
    if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.x) {
      throw new Error('INVALID_KEY_MATERIAL');
    }
  }
  if (wantPrivate && !hasPrivate) throw new Error('INVALID_KEY_MATERIAL');
  if (!wantPrivate && hasPrivate) throw new Error('INVALID_KEY_MATERIAL');
}

function parseJwkJson(material: string): JsonWebKey {
  try {
    const parsed: unknown = JSON.parse(material);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('INVALID_KEY_MATERIAL');
    return parsed as JsonWebKey;
  } catch {
    throw new Error('INVALID_KEY_MATERIAL');
  }
}

async function pemToJwk(
  pem: string,
  alg: AsymmetricJwtAlgorithm,
  isPrivate: boolean
): Promise<JsonWebKey> {
  const key = await webcrypto.subtle.importKey(
    isPrivate ? 'pkcs8' : 'spki',
    pemToBytes(pem),
    subtleAlgorithm(alg),
    true,
    isPrivate ? ['sign'] : ['verify']
  );
  return webcrypto.subtle.exportKey('jwk', key);
}

async function materialToJwk(
  material: string | JsonWebKey,
  alg: AsymmetricJwtAlgorithm,
  isPrivate: boolean
): Promise<JsonWebKey> {
  if (typeof material !== 'string') return material;
  const trimmed = material.trim();
  if (trimmed.startsWith('{')) return parseJwkJson(trimmed);
  if (trimmed.includes('-----BEGIN')) {
    if (isPrivate !== trimmed.includes('PRIVATE')) throw new Error('INVALID_KEY_MATERIAL');
    try {
      return await pemToJwk(trimmed, alg, isPrivate);
    } catch {
      throw new Error('INVALID_KEY_MATERIAL');
    }
  }
  throw new Error('INVALID_KEY_MATERIAL');
}

/**
 * Load a **private** signing key.
 *
 * Accepted material — the forms a Node 22 deployment realistically has in an
 * env var or a mounted secret:
 * - a PKCS#8 PEM (`-----BEGIN PRIVATE KEY-----`),
 * - a JWK as a JSON string,
 * - an already-parsed JWK object.
 *
 * Throws the bare domain error `INVALID_KEY_MATERIAL` when the material is
 * unreadable or does not match `alg` (or is a public key).
 */
export async function loadPrivateKey(
  material: string | JsonWebKey,
  options: KeyLoadOptions
): Promise<PrivateSigningKey> {
  const jwk = stripJwk(await materialToJwk(material, options.alg, true));
  assertShape(jwk, options.alg, true);
  return {
    kid: options.kid,
    alg: options.alg,
    jwk: { ...jwk, alg: options.alg, kid: options.kid },
  };
}

/**
 * Load a **public** verification key. Accepts an SPKI PEM
 * (`-----BEGIN PUBLIC KEY-----`), a JWK JSON string, or a JWK object. Material
 * that carries a private component is rejected — a verifier must be unable to
 * mint.
 */
export async function loadPublicKey(
  material: string | JsonWebKey,
  options: KeyLoadOptions
): Promise<PublicVerificationKey> {
  const jwk = stripJwk(await materialToJwk(material, options.alg, false));
  assertShape(jwk, options.alg, false);
  return {
    kid: options.kid,
    alg: options.alg,
    jwk: { ...jwk, alg: options.alg, kid: options.kid },
  };
}

/**
 * Derive the public half of a private signing key, so the issuer configures
 * one key and still has something to publish.
 */
export function publicKeyFromPrivate(key: PrivateSigningKey): PublicVerificationKey {
  const jwk = key.jwk;
  const publicMembers: JsonWebKey =
    key.alg === 'RS256'
      ? { kty: jwk.kty, n: jwk.n, e: jwk.e }
      : { kty: jwk.kty, crv: jwk.crv, x: jwk.x };
  return { kid: key.kid, alg: key.alg, jwk: { ...publicMembers, alg: key.alg, kid: key.kid } };
}

/**
 * Build the JWKS document a service publishes. Accepts public keys and/or
 * private keys (whose public half is derived), and emits **only** public
 * members — a private component can never reach the document.
 *
 * Which keys go in, and for how long, is the caller's decision: core provides
 * no rotation policy.
 */
export function toJwks(keys: Array<PublicVerificationKey | PrivateSigningKey>): JwksDocument {
  return {
    keys: keys.map((key) => {
      const pub = key.jwk.d ? publicKeyFromPrivate(key as PrivateSigningKey) : key;
      const { d: _d, ...rest } = pub.jwk;
      return { ...rest, alg: pub.alg, kid: pub.kid, use: 'sig' } as JwksKey;
    }),
  };
}
