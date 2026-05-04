/**
 * Phase 4 — parity test against `@builder.io/mitosis`.
 *
 * For each fixture under `test/fixtures/{ts,js}/`, runs both `componentToReact` from this
 * package and from upstream `@builder.io/mitosis` against the same JSON input and asserts
 * byte-exact string equality on the emitted React source.
 *
 * Slice 4.1 scope: a single fixture (`basic`) with a single options shape (default + RSC off)
 * to prove the parity infrastructure works end-to-end. Slice 4.3 will sweep the retained
 * Mitosis option matrix across the full corpus.
 *
 * This file is the ONLY allowed importer of `@builder.io/mitosis` in source/tests; the
 * boundary is enforced by `test/hygiene.test.ts` (Slice 4.4) and the dependency is removed
 * entirely in Phase 7.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentToReact as upstreamComponentToReact } from '@builder.io/mitosis';
import { componentToReact as ourComponentToReact } from '../src';
import type { JsonComponent, ToReactOptions } from '../src/types';

const FIXTURES_DIR = resolve(__dirname, 'fixtures');

/** Read + parse + clone (each generator may mutate the component). */
function loadFixture(mode: 'ts' | 'js', name: string): JsonComponent {
  const path = resolve(FIXTURES_DIR, mode, `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as JsonComponent;
}

function freshClone(component: JsonComponent): JsonComponent {
  return JSON.parse(JSON.stringify(component)) as JsonComponent;
}

function assertParity(name: string, mode: 'ts' | 'js', options: Partial<ToReactOptions>) {
  const component = loadFixture(mode, name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upstream = upstreamComponentToReact(options as any)({ component: freshClone(component) as any });
  const ours = ourComponentToReact(options)({ component: freshClone(component) });
  expect(ours).toEqual(upstream);
}

describe('parity vs @builder.io/mitosis', () => {
  describe('basic.raw.tsx', () => {
    for (const mode of ['ts', 'js'] as const) {
      it(`matches upstream componentToReact (${mode}, default options)`, () => {
        assertParity('basic', mode, {});
      });
    }
  });
});
