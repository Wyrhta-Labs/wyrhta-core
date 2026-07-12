export type AuthScheme = 'api_key' | 'jwt';

/**
 * Decide which auth path a `Authorization` header takes:
 *   `Bearer <keyPrefix>…` → 'api_key'
 *   `Bearer eyJ…`         → 'jwt'   (JWTs always start with the base64url of `{"alg"`)
 * Anything else → null (caller returns 401).
 */
export function detectAuthScheme(
  authHeader: string | undefined,
  keyPrefix: string
): AuthScheme | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (token.length === 0) return null;
  if (token.startsWith(keyPrefix)) return 'api_key';
  if (token.startsWith('eyJ')) return 'jwt';
  return null;
}
