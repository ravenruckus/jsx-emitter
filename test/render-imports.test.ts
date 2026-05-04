import { describe, expect, it } from 'vitest';
import { isLegacyToolchainImportPath } from '../src/internal/legacy-import-filter';
import {
  checkIsComponentImport,
  renderImport,
  renderPreComponent,
  transformImportPath,
} from '../src/internal/render-imports';
import type { JsonComponent, JsonImport } from '../src/types';

const importOf = (overrides: Partial<JsonImport>): JsonImport => ({
  path: 'pkg',
  imports: {},
  ...overrides,
});

const component = (overrides: Partial<JsonComponent> = {}): JsonComponent => ({
  '@type': 'jsx-emitter/component',
  name: 'C',
  imports: [],
  meta: {},
  inputs: [],
  state: {},
  context: { get: {}, set: {} },
  refs: {},
  hooks: { onMount: [], onEvent: [] },
  children: [],
  subComponents: [],
  ...overrides,
});

describe('isLegacyToolchainImportPath', () => {
  it('matches the @builder.io/components package exactly', () => {
    expect(isLegacyToolchainImportPath('@builder.io/components')).toBe(true);
  });
  it('does not match a path that only starts with @builder.io/components', () => {
    expect(isLegacyToolchainImportPath('@builder.io/components-extra')).toBe(false);
  });
  it('matches the @builder.io/mitosis prefix family', () => {
    expect(isLegacyToolchainImportPath('@builder.io/mitosis')).toBe(true);
    expect(isLegacyToolchainImportPath('@builder.io/mitosis/react')).toBe(true);
    expect(isLegacyToolchainImportPath('@builder.io/mitosis-react')).toBe(true);
  });
  it('does not match unrelated paths', () => {
    expect(isLegacyToolchainImportPath('react')).toBe(false);
    expect(isLegacyToolchainImportPath('@builder.io/sdk')).toBe(false);
    expect(isLegacyToolchainImportPath('./foo')).toBe(false);
  });
});

describe('checkIsComponentImport', () => {
  it('returns true for a .lite.tsx path', () => {
    expect(checkIsComponentImport(importOf({ path: '../foo.lite.tsx' }))).toBe(true);
  });
  it('returns true for a .lite.jsx path', () => {
    expect(checkIsComponentImport(importOf({ path: '../foo.lite.jsx' }))).toBe(true);
  });
  it('returns true for a bare .lite path', () => {
    expect(checkIsComponentImport(importOf({ path: '../foo.lite' }))).toBe(true);
  });
  it('returns false for a context.lite path (context, not component)', () => {
    expect(checkIsComponentImport(importOf({ path: '../my.context.lite' }))).toBe(false);
  });
  it('returns false for an unrelated path', () => {
    expect(checkIsComponentImport(importOf({ path: 'react' }))).toBe(false);
  });
});

describe('transformImportPath', () => {
  it('rewrites a context.lite path to context.js (target react)', () => {
    expect(
      transformImportPath({
        theImport: importOf({ path: '../my.context.lite' }),
        target: 'react',
        preserveFileExtensions: false,
        explicitImportFileExtension: false,
      }),
    ).toBe('../my.context.js');
  });
  it('rewrites a context.lite.ts path to context.js', () => {
    expect(
      transformImportPath({
        theImport: importOf({ path: './x.context.lite.ts' }),
        target: 'react',
        preserveFileExtensions: false,
        explicitImportFileExtension: false,
      }),
    ).toBe('./x.context.js');
  });
  it('returns the path unchanged when preserveFileExtensions is true', () => {
    expect(
      transformImportPath({
        theImport: importOf({ path: '../foo.lite.tsx' }),
        target: 'react',
        preserveFileExtensions: true,
        explicitImportFileExtension: false,
      }),
    ).toBe('../foo.lite.tsx');
  });
  it('rewrites a .lite.tsx component path to bare path (implicit extension)', () => {
    expect(
      transformImportPath({
        theImport: importOf({ path: '../foo.lite.tsx' }),
        target: 'react',
        preserveFileExtensions: false,
        explicitImportFileExtension: false,
      }),
    ).toBe('../foo');
  });
  it('rewrites a .lite.tsx component path to .js when explicitImportFileExtension', () => {
    expect(
      transformImportPath({
        theImport: importOf({ path: '../foo.lite.tsx' }),
        target: 'react',
        preserveFileExtensions: false,
        explicitImportFileExtension: true,
      }),
    ).toBe('../foo.js');
  });
  it('returns non-component paths unchanged', () => {
    expect(
      transformImportPath({
        theImport: importOf({ path: 'react' }),
        target: 'react',
        preserveFileExtensions: false,
        explicitImportFileExtension: false,
      }),
    ).toBe('react');
  });

  it.each(['react', 'reactNative'] as const)(
    'rewrites .lite.tsx component path to .js for target %s when explicitImportFileExtension is true',
    (target) => {
      // Locks in current 'react' / 'reactNative' equivalence in
      // getComponentFileExtensionForTarget — a future divergence in
      // component-file-extensions.ts surfaces here as a failure.
      expect(
        transformImportPath({
          theImport: importOf({ path: '../foo.lite.tsx' }),
          target,
          preserveFileExtensions: false,
          explicitImportFileExtension: true,
        }),
      ).toBe('../foo.js');
    },
  );
});

describe('renderImport', () => {
  it('renders a side-effect import when there are no named/default/star imports', () => {
    expect(
      renderImport({
        theImport: importOf({ path: '../foo.scss' }),
        target: 'react',
      }),
    ).toBe("import '../foo.scss';");
  });
  it('renders a default import', () => {
    expect(
      renderImport({
        theImport: importOf({ path: 'react', imports: { React: 'default' } }),
        target: 'react',
      }),
    ).toBe("import  React from 'react';");
  });
  it('renders named imports with aliases', () => {
    expect(
      renderImport({
        theImport: importOf({
          path: 'react',
          imports: { useState: 'useState', useFx: 'useEffect' },
        }),
        target: 'react',
      }),
    ).toBe("import  { useState, useEffect as useFx } from 'react';");
  });
  it('renders default + named imports together', () => {
    expect(
      renderImport({
        theImport: importOf({
          path: 'react',
          imports: { React: 'default', useState: 'useState' },
        }),
        target: 'react',
      }),
    ).toBe("import  React, { useState } from 'react';");
  });
  it('renders a star import (note: upstream emits an extra leading space)', () => {
    expect(
      renderImport({
        theImport: importOf({ path: 'react', imports: { React: '*' } }),
        target: 'react',
      }),
    ).toBe("import   * as React  from 'react';");
  });
  it('emits `import type` when importKind is "type"', () => {
    expect(
      renderImport({
        theImport: importOf({
          path: 'react',
          imports: { Foo: 'Foo' },
          importKind: 'type',
        }),
        target: 'react',
      }),
    ).toBe("import type { Foo } from 'react';");
  });
  it('rewrites .lite component paths via transformImportPath', () => {
    expect(
      renderImport({
        theImport: importOf({ path: '../bar.lite.tsx', imports: { Bar: 'default' } }),
        target: 'react',
      }),
    ).toBe("import  Bar from '../bar';");
  });
});

describe('renderPreComponent', () => {
  it('drops imports whose path is filtered by isLegacyToolchainImportPath', () => {
    const c = component({
      imports: [
        importOf({ path: '@builder.io/mitosis', imports: { useState: 'useState' } }),
        importOf({ path: '@builder.io/components', imports: { Block: 'default' } }),
        importOf({ path: 'react', imports: { useState: 'useState' } }),
      ],
    });
    const out = renderPreComponent({ component: c, target: 'react' });
    expect(out).toContain("from 'react'");
    expect(out).not.toContain('@builder.io/mitosis');
    expect(out).not.toContain('@builder.io/components');
  });

  it('drops .lite component imports when excludeLiteComponents is true', () => {
    const c = component({
      imports: [
        importOf({ path: './foo.lite.tsx', imports: { Foo: 'default' } }),
        importOf({ path: 'react', imports: { useState: 'useState' } }),
      ],
    });
    const out = renderPreComponent({
      component: c,
      target: 'react',
      excludeLiteComponents: true,
    });
    expect(out).not.toContain('foo');
    expect(out).toContain("from 'react'");
  });

  it('also drops non-component paths that contain ".lite" when excludeLiteComponents is true', () => {
    // Locks in upstream's `includes('.lite')` substring match (not a suffix check) so a
    // future tightening surfaces here as a failure rather than a silent behavior change.
    const c = component({
      imports: [
        importOf({ path: './foo.lite-helper', imports: { Helper: 'default' } }),
        importOf({ path: 'react', imports: { useState: 'useState' } }),
      ],
    });
    const out = renderPreComponent({
      component: c,
      target: 'react',
      excludeLiteComponents: true,
    });
    expect(out).not.toContain('foo.lite-helper');
    expect(out).toContain("from 'react'");
  });

  it('renders the component.exports code blocks below imports by default', () => {
    const c = component({
      imports: [importOf({ path: 'react', imports: { useState: 'useState' } })],
      exports: {
        myConst: { code: 'export const myConst = 1;' },
      },
    });
    const out = renderPreComponent({ component: c, target: 'react' });
    expect(out).toContain('export const myConst = 1;');
  });

  it('omits component.exports when excludeExportAndLocal is true', () => {
    const c = component({
      imports: [],
      exports: {
        myConst: { code: 'export const myConst = 1;' },
      },
    });
    const out = renderPreComponent({
      component: c,
      target: 'react',
      excludeExportAndLocal: true,
    });
    expect(out).not.toContain('export const myConst = 1;');
  });

  it('appends the preComponent hook code at the end', () => {
    const c = component({
      hooks: {
        onMount: [],
        onEvent: [],
        preComponent: { code: 'const helper = () => 42;' },
      },
    });
    const out = renderPreComponent({ component: c, target: 'react' });
    expect(out).toContain('const helper = () => 42;');
  });
});
