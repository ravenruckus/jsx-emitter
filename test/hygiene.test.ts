import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');

const readText = (relPath: string) => readFileSync(resolve(repoRoot, relPath), 'utf8');

// Phase 4 carve-out: @builder.io/mitosis is a temporary devDependency used only
// by test/parity.test.ts and scripts/extract-fixtures.ts for differential testing
// against upstream. Removed in Phase 7 — at which point these allowlist patterns
// and the carve-out test below should also be removed.
//
// `PHASE_4_PARITY_DEP_LINE` matches the devDep entry: `"@builder.io/mitosis": "X.Y.Z",`
// `PHASE_4_OVERRIDE_KEY_LINE` matches the npm `overrides` block opener that nests
// `@babel/generator@7.18.2` under mitosis (needed because mitosis@0.13.0's parser
// requires the older babel/generator that matches its pinned `@babel/core@7.14.5`).
const PHASE_4_PARITY_DEP_LINE = /^\s*"@builder\.io\/mitosis":\s*"[^"]+",?\s*$/;
const PHASE_4_OVERRIDE_KEY_LINE = /^\s*"@builder\.io\/mitosis":\s*\{\s*$/;

describe('hygiene: no upstream-toolchain references in package metadata', () => {
  it('package.json has no case-insensitive match for "mitosis" (excluding parity devDep + override)', () => {
    const text = readText('package.json');
    const stripped = text
      .split('\n')
      .filter(
        (line) =>
          !PHASE_4_PARITY_DEP_LINE.test(line) && !PHASE_4_OVERRIDE_KEY_LINE.test(line),
      )
      .join('\n');
    expect(stripped).not.toMatch(/mitosis/i);
  });

  it('tsconfig.json has no case-insensitive match for "mitosis"', () => {
    const text = readText('tsconfig.json');
    expect(text).not.toMatch(/mitosis/i);
  });

  it('vitest.config.ts has no case-insensitive match for "mitosis"', () => {
    const text = readText('vitest.config.ts');
    expect(text).not.toMatch(/mitosis/i);
  });
});
