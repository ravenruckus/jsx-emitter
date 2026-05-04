import { describe, expect, it } from 'vitest';
import {
  COMPONENT_IMPORT_EXTENSIONS,
  INPUT_EXTENSION_REGEX,
  getComponentFileExtensionForTarget,
} from '../src/internal/component-file-extensions';

describe('COMPONENT_IMPORT_EXTENSIONS', () => {
  it('contains the .lite.tsx and .lite.jsx component extensions', () => {
    expect(COMPONENT_IMPORT_EXTENSIONS).toContain('.lite.tsx');
    expect(COMPONENT_IMPORT_EXTENSIONS).toContain('.lite.jsx');
  });
  it('contains the bare .lite extension as a fallback', () => {
    expect(COMPONENT_IMPORT_EXTENSIONS).toContain('.lite');
  });
  it('contains the .svelte extension for input-format compatibility', () => {
    // Upstream parser output may carry .svelte paths through into JSON;
    // detection must treat them as component imports.
    expect(COMPONENT_IMPORT_EXTENSIONS).toContain('.svelte');
  });
});

describe('INPUT_EXTENSION_REGEX', () => {
  it('matches .lite.tsx', () => {
    expect('foo.lite.tsx'.match(INPUT_EXTENSION_REGEX)).not.toBeNull();
  });
  it('matches .lite.jsx', () => {
    expect('foo.lite.jsx'.match(INPUT_EXTENSION_REGEX)).not.toBeNull();
  });
  it('matches plain .lite', () => {
    expect('foo.lite'.match(INPUT_EXTENSION_REGEX)).not.toBeNull();
  });
  it('matches .svelte', () => {
    expect('foo.svelte'.match(INPUT_EXTENSION_REGEX)).not.toBeNull();
  });
  it('does not match .ts', () => {
    expect('foo.ts'.match(INPUT_EXTENSION_REGEX)).toBeNull();
  });
});

describe('getComponentFileExtensionForTarget', () => {
  it('react import returns "" by default (implicit extension)', () => {
    expect(
      getComponentFileExtensionForTarget({
        target: 'react',
        type: 'import',
        explicitImportFileExtension: false,
      }),
    ).toBe('');
  });

  it('react import returns ".js" when explicitImportFileExtension is true', () => {
    expect(
      getComponentFileExtensionForTarget({
        target: 'react',
        type: 'import',
        explicitImportFileExtension: true,
      }),
    ).toBe('.js');
  });

  it('react filename returns ".tsx" when typescript', () => {
    expect(
      getComponentFileExtensionForTarget({
        target: 'react',
        type: 'filename',
        isTypescript: true,
      }),
    ).toBe('.tsx');
  });

  it('react filename returns ".jsx" when not typescript', () => {
    expect(
      getComponentFileExtensionForTarget({
        target: 'react',
        type: 'filename',
        isTypescript: false,
      }),
    ).toBe('.jsx');
  });

  it('reactNative behaves identically to react for filename + import branches', () => {
    expect(
      getComponentFileExtensionForTarget({
        target: 'reactNative',
        type: 'filename',
        isTypescript: true,
      }),
    ).toBe('.tsx');
    expect(
      getComponentFileExtensionForTarget({
        target: 'reactNative',
        type: 'import',
        explicitImportFileExtension: false,
      }),
    ).toBe('');
  });
});
