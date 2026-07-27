# Changelog

All notable changes to `@wyrhta/core` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) —
pre-1.0, a minor bump may break compatibility, a patch bump is safe.

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
