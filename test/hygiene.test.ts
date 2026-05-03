import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');

const readText = (relPath: string) => readFileSync(resolve(repoRoot, relPath), 'utf8');

describe('hygiene: no upstream-toolchain references in package metadata', () => {
  it('package.json has no case-insensitive match for "mitosis"', () => {
    const text = readText('package.json');
    expect(text).not.toMatch(/mitosis/i);
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
