# @wyrhta/core

Shared foundation library for Wyrhta Labs household-manager services
([Heorth](https://github.com/Wyrhta-Labs/Heorth), [KithLedger](https://github.com/Wyrhta-Labs/KithLedger)).
It is consumed as a **pinned GitHub-tag dependency**, never a workspace/local
link — each service is an independent repo:

```json
{
  "dependencies": {
    "@wyrhta/core": "github:Wyrhta-Labs/wyrhta-core#v0.3.0"
  }
}
```

A change here only reaches consumers when a new tag is cut and the
consumer's `package.json` pin is deliberately bumped.

## Module map

Each subpath below is an independent `exports` entry — import only what you need.

| Subpath | What it provides |
|---|---|
| `@wyrhta/core/config` | Zod-based environment parsing |
| `@wyrhta/core/lib` | API-key crypto helpers, structured logger |
| `@wyrhta/core/http` | Response envelope (`ok`/`err`), pagination helpers, and `requestId` / `securityHeaders` / `rateLimit` / `errorHandler` Hono middleware |
| `@wyrhta/core/identity` | `users` + `api_keys` schema, argon2 password hashing, JWT issuing/verification — HS256 shared secret or RS256 / EdDSA keys with `kid` selection, optional `iss` / `aud` claims and clock-skew leeway — plus key loading and JWKS document construction, roles (`admin` / `adult` / `child`) |
| `@wyrhta/core/auth` | Auth-scheme dispatch and Hono guards (`requireAuth`, `requireJwt`, `requireRole`); the consuming app injects the API-key lookup and, optionally, the expected JWT issuer/audience, public verification keys, and clock-skew leeway |
| `@wyrhta/core/household` | DB-enforced singleton household |
| `@wyrhta/core/db` | Drizzle ORM / `postgres.js` client factory plus a migrations runner |

## What core is NOT

- No business domains — no bills, chores, contacts, ledgers, or any other
  service-specific concept lives here.
- No UI.
- DB-agnostic where it touches application tables: core does not assume or
  own app-level tables outside of its own (identity, household). Apps inject
  their own lookups (e.g. the API-key lookup in `./auth`) rather than core
  reaching into app schema.
- No speculative features. New capabilities land **demand-driven only** —
  when a consumer concretely needs them, not in anticipation of future use.

## Domain error codes

Core signals expected, caller-actionable failures by throwing a bare `Error`
whose message is an **UPPER_SNAKE_CASE code** matching
`^[A-Z][A-Z0-9_]{1,63}$` — e.g. `INVALID_TOKEN`, `TOKEN_EXPIRED`,
`INVALID_ISSUER`, `INVALID_AUDIENCE`, `UNKNOWN_KEY_ID`, `INVALID_ALGORITHM`,
`INVALID_KEY_MATERIAL`, `MISSING_JWT_VERIFICATION_KEY`, `CONFLICT`. Anything
else that escapes core (driver errors, Zod internals, non-`Error` throws) is
an *unexpected* failure and carries no such contract.

The distinction is deliberate and consumer-facing: a caller may match on the
shape to decide what is safe to surface to a client and what must be
collapsed into a generic message. Keep new core error codes in this style.

> This convention used to be implemented and documented in the `./mcp`
> scaffold, which was removed in 0.3.0 (ADR 0008). It is documented here
> because core's own modules — `./identity`, `./auth` — still depend on it.

## Release discipline

- Every change ships as a semver tag plus a `CHANGELOG.md` entry.
- Pre-1.0: a **minor** bump may break compatibility; a **patch** bump is safe
  to take without review.
- Consumers upgrade by a deliberate pin-bump of the `#vX.Y.Z` tag in their
  `package.json` — there is no auto-update.

## Requirements

- Node.js **>= 22.12** (the package is ESM-only; `require()` from CJS
  tooling such as drizzle-kit works via Node's `require(ESM)` support, which
  needs 22.12+).

## Development

```
npm run build          # tsc --project tsconfig.json
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run test:watch     # vitest (watch mode)
npm run db:generate    # drizzle-kit generate
npm run db:migrate     # drizzle-kit migrate
npm run db:push        # drizzle-kit push
npm run db:studio      # drizzle-kit studio
```
