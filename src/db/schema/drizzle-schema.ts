// drizzle-kit's CJS bundler cannot resolve .js suffixes on .ts files; this
// suffix-free mirror of ./index.ts is the one drizzle.config.ts points at.
export * from '../../identity/schema';
export * from '../../household/schema';
