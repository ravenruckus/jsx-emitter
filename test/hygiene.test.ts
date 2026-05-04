import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');

const readText = (relPath: string) => readFileSync(resolve(repoRoot, relPath), 'utf8');

// Phase 4 carve-out: @builder.io/mitosis is a temporary devDependency used only
// by test/parity.test.ts and scripts/extract-fixtures.ts for differential testing
// against upstream. Removed in Phase 7 — at which point this allowlist line
// (PHASE_4_PARITY_DEP_LINE) and the carve-out test below should also be removed.
const PHASE_4_PARITY_DEP_LINE = /^\s*"@builder\.io\/mitosis":\s*"[^"]+",?\s*$/;

describe('hygiene: no upstream-toolchain references in package metadata', () => {
  it('package.json has no case-insensitive match for "mitosis" (excluding parity devDep)', () => {
    const text = readText('package.json');
    const stripped = text
      .split('\n')
      .filter((line) => !PHASE_4_PARITY_DEP_LINE.test(line))
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
