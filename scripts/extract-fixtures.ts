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
 * Slice 4.1 scope: extracts a single fixture (`basic.raw.tsx`) end-to-end as a smoke test.
 * Slice 4.2 will generalize this to the full retained corpus.
 *
 * Lifecycle: archived (deleted) at the end of Phase 7 along with the parity test
 * and the `@builder.io/mitosis` devDependency.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseJsx } from '@builder.io/mitosis';

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

interface FixtureSpec {
  /** Path relative to the upstream `__tests__/data/` directory. */
  source: string;
  /** Output path relative to `test/fixtures/<mode>/`, no `.json` extension. */
  out: string;
}

/** Slice 4.1: smoke-test corpus is just `basic.raw.tsx`. */
const FIXTURES: FixtureSpec[] = [{ source: 'basic.raw.tsx', out: 'basic' }];

function extract(spec: FixtureSpec): void {
  const src = readFileSync(join(UPSTREAM_DATA, spec.source), 'utf8');
  for (const mode of ['ts', 'js'] as const) {
    const component = parseJsx(src, { typescript: mode === 'ts' });
    const outPath = join(OUT_DIR, mode, `${spec.out}.json`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(component, null, 2) + '\n', 'utf8');
  }
}

for (const spec of FIXTURES) {
  extract(spec);
  // eslint-disable-next-line no-console
  console.log(`extracted ${spec.source} → ${spec.out}.json (ts + js)`);
}
