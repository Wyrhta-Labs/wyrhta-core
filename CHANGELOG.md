# Changelog

All notable changes to `@wyrhta/core` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) —
pre-1.0, a minor bump may break compatibility, a patch bump is safe.

## [0.4.0] - 2026-08-19

A security release. Every dependency advisory against `@wyrhta/core` is closed.
The `drizzle-orm` range moved across a `0.x` minor, so consumers must upgrade
in step — see **Breaking** below.

### Breaking

- **`drizzle-orm` now requires `^0.45.2`** (was `^0.39.3`). A service that pins
  `drizzle-orm` itself must move to the same range, or npm resolves two copies
  of the ORM and the `PostgresJsDatabase` types stop matching across the
  boundary.

### Security

- **Cleared all eight open Dependabot alerts; `npm audit` now reports zero
  vulnerabilities.** The two that reach consumers were dependency ranges, not
  just lockfile pins, so the declared ranges moved too:

  - `drizzle-orm` `^0.39.3` -> `^0.45.2` — SQL injection via improperly escaped
    SQL identifiers (GHSA-gpj5-g38j-94v9, high). This library never calls
    `sql.identifier()` or `sql.as()`, so it was not itself exposed, but the
    vulnerable range shipped to every service that depends on `@wyrhta/core`.
  - `hono` `^4.7.4` -> `^4.12.34` — four advisories: `memo()` retaining SSR
    output across requests (cross-user data disclosure), ReDoS in the CORS
    middleware, algorithmic-complexity DoS in the language middleware, and the
    Proxy Helper leaking hop-by-hop response headers.

  Dev-only, resolved by lockfile refresh: `postcss` 8.5.17 -> 8.5.26 (two
  sourceMappingURL path-traversal advisories) and `brace-expansion` (DoS).

- **`drizzle-kit` `^0.30.4` -> `^0.31.10`**, which drops the `esbuild ^0.19.7`
  dependency carrying GHSA-67mh-4wv8-2f99. 0.31.x still depends on the
  deprecated `@esbuild-kit/*` packages, and `@esbuild-kit/core-utils` hard-pins
  `esbuild ~0.18.20`, so an `overrides` entry forces that one onto the patched
  line as well. It only uses esbuild's `transform()`, which is unchanged from
  0.18 to 0.25. The override can go once drizzle-kit 1.x is stable.

### Fixed

- **`isUniqueViolation()` stopped recognising unique violations** under
  drizzle-orm >= 0.44, which wraps every driver error in `DrizzleQueryError` and
  moves the postgres.js error (and its `code`) onto `cause`. The check read
  `code` off the top-level error only, so a duplicate email or handle would have
  escaped `createUser()`'s `CONFLICT` branch and surfaced as an unhandled error
  instead of a 409. It now walks the `cause` chain. The existing tests use mock
  `db` objects and could not catch this, so there are now tests built on the
  real `DrizzleQueryError`.

## [0.3.1] - 2026-08-19

No API change. This release exists to move the library onto a real registry.

### Added

- **Published to npmjs.com as `@wyrhta/core`**, via npm trusted publishing from
  GitHub Actions (ADR 0011). Authentication is OIDC, so no npm token is stored
  in this repo, and every published tarball carries a provenance attestation
  naming the workflow, repository, and commit that built it.

  Consumers can move from the git-tag pin to a normal semver range:

  ```json
  { "@wyrhta/core": "^0.3.1" }
  ```

  which removes the requirement for `git` and a TypeScript toolchain at install
  time, removes the second repository built during `npm install`, and lets
  Dependabot see the dependency at all. The git-tag form keeps working and
  remains the right way to test an unreleased change against a consumer.

- **MIT licence**, plus `SECURITY.md` and `CONTRIBUTING.md`, as part of the
  Wyrhta Labs repos going public.

### Fixed

- **CI ran on nothing.** The workflow triggered on a `staging` branch this repo
  does not use, so the library every service pins had no automated checks. It
  now runs on push and pull request against `main`.

## [0.3.0] - 2026-08-19

### Removed

- **The `./mcp` module and the `@modelcontextprotocol/sdk` dependency.**
  ADR 0008 made MCP a standalone container (`heorth-mcp`) that talks to
  Heorth and KithLedger over their REST APIs, so the scaffold no longer
  belongs in the shared foundation. Deleted: `src/mcp/{index,scaffold,types}.ts`
  (`createMcpServer`, `McpTool`, `McpToolContext`, `McpToolResult`,
  `McpPrincipal`, `AuthAdapter`), their re-export from the root barrel, the
  `./mcp` `exports` entry, and `tests/mcp/`.

  The code did not vanish — `heorth-mcp` took a copy as its own source and has
  evolved it well past this version (its registry now serves 50 tools). Core
  keeps only what both REST services still need.

  The real prize is the dependency: `@modelcontextprotocol/sdk` was the only
  consumer of that scaffold, and dropping it here removes it from both
  production services' dependency trees as well — neither Heorth nor
  KithLedger imports MCP any more.

  **Breaking.** Any import of `@wyrhta/core/mcp`, or of an `Mcp*` symbol from
  the root barrel, stops resolving. Consumers must be on a build that no
  longer imports the scaffold before bumping their pin to `v0.3.0`; both
  current consumers already are.

### Changed

- The UPPER_SNAKE_CASE domain-error convention (`^[A-Z][A-Z0-9_]{1,63}$`) is
  now documented in `README.md` (§ "Domain error codes") and in
  `src/identity/jwt.ts`, rather than only in the deleted `./mcp` scaffold that
  happened to enforce it. It stays load-bearing for core's own codes —
  `INVALID_TOKEN`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `UNKNOWN_KEY_ID`,
  `INVALID_ALGORITHM`, `TOKEN_EXPIRED`, `INVALID_KEY_MATERIAL`,
  `MISSING_JWT_VERIFICATION_KEY`, `CONFLICT`.


## [0.2.0] - 2026-08-18

### Added

- JWT issuer/audience convention in `./identity`, so a token can say which
  service minted it and which service it is for (groundwork for Heorth
  issuing member tokens that a satellite service verifies):
  - `TokenClaims` gains optional `iss` and `aud`.
  - `signToken` accepts `iss` / `aud` and writes each claim **only** when
    supplied — a token signed without them keeps its exact previous
    `{ sub, role, iat, exp }` payload.
  - `verifyToken`'s third argument now accepts either the bare algorithm (the
    original form, still supported) or a `VerifyTokenOptions` object
    (`{ algorithm?, iss?, aud? }`). An expectation is enforced only when
    given; a mismatch — including a missing claim — throws the bare
    UPPER_SNAKE_CASE domain errors `INVALID_ISSUER` / `INVALID_AUDIENCE`,
    matching the code convention the `./mcp` scaffold surfaces.
  - `issueToken` takes an optional 4th argument `{ iss?, aud? }`.
  - `createAuthGuards` deps take optional `jwtIssuer` / `jwtAudience`; when
    set, `requireAuth` / `requireJwt` reject tokens from another issuer or for
    another audience with the usual 401.

- Asymmetric member tokens in `./identity`, so an identity provider can sign
  with a private key while a satellite service only ever verifies and is
  structurally unable to mint:
  - New key surface: `loadPrivateKey` / `loadPublicKey` (PKCS#8 or SPKI PEM,
    a JWK JSON string, or a JWK object — the caller supplies the material;
    core still reads no env and no files), `publicKeyFromPrivate`, and
    `toJwks`, which builds the `{ keys: [...] }` JWKS document a service
    publishes. Core builds the document, the consuming service serves it;
    the output can never carry a private component.
  - `signToken` / `issueToken` accept a `PrivateSigningKey` in place of the
    shared secret and sign RS256 or EdDSA (Ed25519), stamping that key's
    `kid` into the JWT header.
  - `verifyToken` accepts a single public key or a **set** of them and selects
    by the token header's `kid` (`UNKNOWN_KEY_ID` when none matches). A token
    signed by any other key fails signature verification, and an HS256 token
    cannot pass against public keys.
  - `createAuthGuards` deps take `jwtVerificationKeys`; when set they replace
    `jwtSecret` for JWT verification, and `jwtSecret` itself is now optional so
    a pure verifier need not hold one at all (with neither given,
    `createAuthGuards` throws `MISSING_JWT_VERIFICATION_KEY`).

- Clock-skew leeway: `verifyToken`'s `leewaySeconds` option, and the guards'
  `jwtLeewaySeconds`, widen the `exp` / `nbf` / `iat` checks — needed for
  short-TTL tokens verified across two containers. It defaults to `0`, exactly
  the previous tolerance-free behavior. `hono/jwt` has no leeway of its own, so
  core takes over the time checks (throwing `TOKEN_EXPIRED` /
  `TOKEN_NOT_BEFORE` / `TOKEN_ISSUED_AT`) only when a leeway is requested.

  Strictly backward compatible: every existing call site — both consumers pass
  a shared secret and no issuer/audience today — behaves exactly as before, and
  tokens already issued (7-day HS256) stay valid. Key rotation *policy*
  (overlapping validity windows, when to retire a key) is deliberately out of
  scope: core provides the mechanism, the issuing service decides the policy.

## [0.1.3] - 2026-07-27

### Fixed

- The `./mcp` server scaffold no longer collapses every tool-handler throw
  into the generic "Unauthorized or tool error" message. Handler errors whose
  message is a bare UPPER_SNAKE_CASE domain code (e.g. `NOT_FOUND`,
  `CONFLICT`) are now surfaced verbatim to MCP clients (`isError: true`);
  anything else (raw driver errors, non-`Error` throws) stays a generic
  "tool error". Auth failures (`authAdapter.resolve()` throws) still return
  the original generic message unconditionally, so auth details can never
  leak — even when the thrown message looks like a domain code.

## [0.1.2] - 2026-07-23

### Added

- `README.md`: module map, "what core is NOT" boundary statement, release
  discipline, requirements, and dev commands.
- `CHANGELOG.md` (this file).

### Fixed

- Stale version constants: `CORE_VERSION` in `src/index.ts` and the default
  `info.version` in the `./mcp` server scaffold were still `0.1.0`; both now
  match the package version.

## [0.1.1] - 2026-07-12

### Fixed

- Added a CJS-resolvable `default` export condition to every subpath so
  CJS tooling that `require()`s the package — notably drizzle-kit, which
  bundles the schema graph and `require()`s external deps — no longer hits
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. The `default` condition (listed last)
  points at the same ESM build and is loaded via Node's `require(ESM)`
  support (Node >= 22.12); ESM `import` behavior is unchanged.

## [0.1.0] - 2026-07-12

### Added

- Initial foundation library: `config`, `lib`, `http`, `identity`, `auth`,
  `household`, `mcp`, and `db` modules.
