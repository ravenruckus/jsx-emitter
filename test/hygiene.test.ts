import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..');

const readText = (relPath: string) => readFileSync(resolve(repoRoot, relPath), 'utf8');

/** Walk a directory tree and return all `.ts` (or `.tsx`) files relative to `repoRoot`. */
function listTsFiles(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const path = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(path);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        out.push(relative(repoRoot, path).split(sep).join('/'));
      }
    }
  };
  walk(rootDir);
  return out.sort();
}

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

// Phase 4 boundary guard: only the parity test and the extraction script may
// import from `@builder.io/mitosis`. Every other source/test file must stay
// independent of the upstream toolchain so Phase 7's "delete the dep + run
// build/test green" check passes without source edits.
//
// The two allowlisted paths are deleted in Phase 7, at which point this guard becomes vacuous and can be removed.
const PHASE_4_ALLOWED_IMPORTERS = new Set<string>([
  'test/parity.test.ts',
  'scripts/extract-fixtures.ts',
]);

/**
 * Matches a real `import ... from '@builder.io/mitosis'` line — including the
 * `} from '@builder.io/mitosis';` continuation line of a multi-line import.
 *
 * The line-anchored `^\s*(import|})` prefix avoids false positives in source
 * lines like `const code = \`import { Signal } from '@builder.io/mitosis'\`` where
 * the import-shaped text appears inside a template literal (see e.g.
 * `test/signals.test.ts:6`, which exercises signal-type detection on string
 * inputs that contain mitosis imports).
 */
const MITOSIS_IMPORT_LINE = /^\s*(?:import\b|})[^;]*\bfrom\s+['"]@builder\.io\/mitosis['"]/;

function findMitosisImportLine(text: string): number | null {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (MITOSIS_IMPORT_LINE.test(lines[i])) return i + 1;
  }
  return null;
}

describe('hygiene: only parity scaffolding may import @builder.io/mitosis', () => {
  it('no other source/test/script file imports from @builder.io/mitosis', () => {
    const offenders: string[] = [];
    for (const dir of ['src', 'test', 'scripts'] as const) {
      const root = resolve(repoRoot, dir);
      let files: string[];
      try {
        files = listTsFiles(root);
      } catch {
        continue; // directory may not exist
      }
      for (const rel of files) {
        if (PHASE_4_ALLOWED_IMPORTERS.has(rel)) continue;
        const lineNumber = findMitosisImportLine(readText(rel));
        if (lineNumber !== null) offenders.push(`${rel}:${lineNumber}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the allowlisted importers actually exist and import from @builder.io/mitosis', () => {
    // Sanity guard: prevents the allowlist from going stale (e.g., if someone
    // renames `parity.test.ts`). If both files are present and importing from
    // upstream, the allowlist is being meaningfully exercised.
    for (const rel of PHASE_4_ALLOWED_IMPORTERS) {
      expect(findMitosisImportLine(readText(rel))).not.toBeNull();
    }
  });

  it('detects single-line imports (positive control)', () => {
    const synthetic = `import { foo } from '@builder.io/mitosis';\nconsole.log(foo);\n`;
    expect(findMitosisImportLine(synthetic)).toBe(1);
  });

  it('detects multi-line imports — the `} from` continuation line (positive control)', () => {
    const synthetic = `import {\n  foo,\n  bar,\n} from '@builder.io/mitosis';\n`;
    expect(findMitosisImportLine(synthetic)).toBe(4);
  });

  it('does not flag mitosis import strings inside template literals (negative control)', () => {
    // Mirrors `test/signals.test.ts:6` — the test fixture there embeds an import
    // statement inside a JS template literal because it's testing `getSignalImportName`'s
    // ability to detect `Signal` imports in arbitrary code blobs. That's not a real
    // import of the package, just a string fixture.
    const synthetic = "const code = `import { Signal } from '@builder.io/mitosis';`;\n";
    expect(findMitosisImportLine(synthetic)).toBeNull();
  });
});
