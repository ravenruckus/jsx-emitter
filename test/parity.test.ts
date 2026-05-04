/**
 * Phase 4 — parity test against `@builder.io/mitosis`.
 *
 * For each fixture under `test/fixtures/{ts,js}/`, runs both `componentToReact` from this
 * package and from upstream `@builder.io/mitosis` against the same JSON input and asserts
 * byte-exact string equality on the emitted React source.
 *
 * Slice 4.2 scope: full retained corpus (~136 fixtures × 2 modes = 272 cases) with default
 * options. Slice 4.3 will sweep the option matrix (stateType=variables, native, style-tag,
 * twrnc/native-wind, etc.).
 *
 * This file is the ONLY allowed importer of `@builder.io/mitosis` in source/tests; the
 * boundary is enforced by `test/hygiene.test.ts` (Slice 4.4) and the dependency is removed
 * entirely in Phase 7.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentToReact as upstreamComponentToReact } from '@builder.io/mitosis';
import { componentToReact as ourComponentToReact } from '../src';
import type { JsonComponent, ToReactOptions } from '../src/types';

const FIXTURES_DIR = resolve(__dirname, 'fixtures');

type Mode = 'ts' | 'js';

function listFixtures(mode: Mode): string[] {
  const root = resolve(FIXTURES_DIR, mode);
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const path = join(abs, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        out.push(relative(root, path).split(sep).join('/').replace(/\.json$/, ''));
      }
    }
  };
  if (statSync(root, { throwIfNoEntry: false })?.isDirectory()) walk(root);
  return out.sort();
}

function loadFixture(mode: Mode, name: string): JsonComponent {
  const path = resolve(FIXTURES_DIR, mode, `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as JsonComponent;
}

function freshClone(component: JsonComponent): JsonComponent {
  return JSON.parse(JSON.stringify(component)) as JsonComponent;
}

type Outcome =
  | { kind: 'value'; value: string }
  | { kind: 'throw'; message: string };

function runOnce(
  generator: (component: JsonComponent) => string,
  component: JsonComponent,
): Outcome {
  try {
    return { kind: 'value', value: generator(freshClone(component)) };
  } catch (err) {
    return { kind: 'throw', message: (err as Error).message };
  }
}

function runParity(name: string, mode: Mode, options: Partial<ToReactOptions>) {
  const component = loadFixture(mode, name);
  // Some upstream fixtures (e.g., `store/string-literal-store-kebab`) are flagged in
  // `runTestsForTarget` with `failFor: ['react', ...]` — upstream's runner only
  // asserts `toThrowError()` for these (test-generator.ts:797), so we treat any
  // matched-throw pair as parity. A success/throw split between the two is a fail.
  // (Exact message equality on throws is too strict: pre-prettier whitespace can
  // drift in ways prettier would normalize on success but exposes when it fails.)
  const upstream = runOnce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c) => upstreamComponentToReact(options as any)({ component: c as any }),
    component,
  );
  const ours = runOnce(
    (c) => ourComponentToReact(options)({ component: c }),
    component,
  );
  if (upstream.kind === 'throw' && ours.kind === 'throw') return;
  expect(ours).toEqual(upstream);
}

describe('parity vs @builder.io/mitosis', () => {
  for (const mode of ['ts', 'js'] as const) {
    const fixtures = listFixtures(mode);
    if (fixtures.length === 0) continue;
    describe(`mode=${mode} — default options`, () => {
      for (const name of fixtures) {
        it(name, () => {
          runParity(name, mode, {});
        });
      }
    });
  }
});
