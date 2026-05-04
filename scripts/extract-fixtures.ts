/**
 * Phase 4 — fixture extraction script.
 *
 * Walks the upstream Mitosis test data corpus (`mitosis/packages/core/src/__tests__/data/**\/*.raw.tsx`),
 * runs each `.raw.tsx` source through `@builder.io/mitosis`'s `parseJsx` in both `typescript: true`
 * and `typescript: false` modes, and writes the resulting JSON component to
 * `jsx-emitter/test/fixtures/{ts,js}/<rel-path-without-ext>.json`.
 *
 * Output JSON is consumed by `test/parity.test.ts`.
 *
 * Lifecycle: archived (deleted) at the end of Phase 7 along with the parity test
 * and the `@builder.io/mitosis` devDependency.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { createTypescriptProject, parseJsx } from '@builder.io/mitosis';

const ROOT = resolve(__dirname, '..');
const UPSTREAM_DATA = resolve(
  ROOT,
  '..',
  'mitosis',
  'packages',
  'core',
  'src',
  '__tests__',
  'data',
);
const OUT_DIR = resolve(ROOT, 'test', 'fixtures');
/**
 * Reuse the upstream tests' tsconfig so type lookups in `parseJsx({ typescript: true, tsProject })`
 * see the same module-resolution paths that upstream's own tests do.
 *
 * Without `tsProject`, the parser fails to read symbol tokens for fixtures that destructure
 * typed props (e.g. `blocks/image.raw.tsx` with its `ImageProps` interface).
 */
const UPSTREAM_TSCONFIG = resolve(UPSTREAM_DATA, '..', 'tsconfig.json');
const tsProject = createTypescriptProject(UPSTREAM_TSCONFIG);

/**
 * Subdirectories of `data/` whose fixtures only feed non-React/RN target buckets
 * (per `JSX_TESTS_FOR_TARGET` in the upstream `test-generator.ts`). Skipped to keep
 * the corpus aligned with what the retained Mitosis test suites would actually run.
 */
const SKIP_DIRS = new Set(['angular', 'swift']);

/**
 * Source paths (relative to `data/`) that are excluded from the React / React Native
 * runs in upstream's `test-generator.ts` even though they live in shared subfolders.
 *
 * - `for/advanced-for.raw.tsx`, `for/basic-for-show.raw.tsx`, `blocks/section-state.raw.tsx`
 *   are only referenced by `FOR_SHOW_TESTS`, which is commented out for both `react`
 *   and `reactNative` (`test-generator.ts` lines 434, 580).
 * - `basic-custom-mitosis-package.raw.tsx` requires a `compileAwayPackages` parser
 *   option only used by the special "Remove Internal mitosis package" test inside
 *   `runTestsForTarget`. Slice 4.3 will handle that one with a dedicated case.
 */
const SKIP_FILES = new Set([
  'for/advanced-for.raw.tsx',
  'for/basic-for-show.raw.tsx',
  'blocks/section-state.raw.tsx',
  'basic-custom-mitosis-package.raw.tsx',
]);

function listFixtures(): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const path = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path);
      } else if (entry.isFile() && entry.name.endsWith('.raw.tsx')) {
        const rel = relative(UPSTREAM_DATA, path).split(sep).join('/');
        if (SKIP_FILES.has(rel)) continue;
        out.push(rel);
      }
    }
  };
  walk(UPSTREAM_DATA);
  return out.sort();
}

function extract(rel: string): void {
  const src = readFileSync(join(UPSTREAM_DATA, rel), 'utf8');
  const outBase = rel.replace(/\.raw\.tsx$/, '');
  // Absolute path so ts-morph's tsProject (rooted at upstream's `src/__tests__/tsconfig.json`)
  // can locate the source file regardless of the script's CWD. Upstream's test-generator gets
  // away with relative `src/__tests__/<rel>` paths because it's invoked from
  // `mitosis/packages/core/`; we run from `jsx-emitter/`.
  const filePath = join(UPSTREAM_DATA, rel);
  for (const mode of ['ts', 'js'] as const) {
    let component;
    try {
      component = parseJsx(
        src,
        mode === 'ts'
          ? { typescript: true, filePath, tsProject }
          : { typescript: false, filePath },
      );
    } catch (err) {
      throw new Error(`parseJsx failed for ${rel} in ${mode} mode: ${(err as Error).message}`, {
        cause: err,
      });
    }
    const outPath = join(OUT_DIR, mode, `${outBase}.json`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(component, null, 2) + '\n', 'utf8');
  }
}

const fixtures = listFixtures();
for (const rel of fixtures) {
  extract(rel);
}
// eslint-disable-next-line no-console
console.log(`extracted ${fixtures.length} fixtures × 2 modes = ${fixtures.length * 2} JSON files`);
