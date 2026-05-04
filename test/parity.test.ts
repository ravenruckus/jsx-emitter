/**
 * Phase 4 — parity test against `@builder.io/mitosis`.
 *
 * For each fixture and each retained option permutation from upstream's `react.test.ts`,
 * `react-state-variables.test.ts`, `react-native.test.ts`, and `react-handbuilt.test.ts`,
 * runs both implementations and asserts byte-exact string equality (or matched-throw,
 * for fixtures upstream flags as `failFor: ['react', ...]`).
 *
 * Slices:
 *   4.1 — single fixture × default options (smoke).
 *   4.2 — full corpus × default options (`componentToReact`).
 *   4.3 — option-matrix sweep:
 *           - corpus × `stateType: 'variables'` (mirrors upstream's `react-state-variables`)
 *           - corpus × `componentToReactNative` defaults
 *           - inline cases from `react.test.ts` and `react-native.test.ts`
 *           - hand-built component inputs from `react-handbuilt.test.ts`
 *           - the `compileAwayPackages` case ("Remove Internal mitosis package")
 *
 * This file is the ONLY allowed importer of `@builder.io/mitosis` in source/tests;
 * the boundary is enforced by `test/hygiene.test.ts` (Slice 4.4) and the dependency
 * is removed entirely in Phase 7.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  componentToReact as upstreamComponentToReact,
  componentToReactNative as upstreamComponentToReactNative,
  parseJsx as upstreamParseJsx,
} from '@builder.io/mitosis';
import {
  componentToReact as ourComponentToReact,
  componentToReactNative as ourComponentToReactNative,
} from '../src';
import type { JsonComponent, ToReactOptions, ToReactNativeOptions } from '../src/types';

const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const UPSTREAM_DATA = resolve(
  __dirname,
  '..',
  '..',
  'mitosis',
  'packages',
  'core',
  'src',
  '__tests__',
  'data',
);

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

/**
 * Asserts that upstream and our implementation produce identical output (or both throw).
 *
 * Upstream's runner uses bare `expect(getOutput).toThrowError()` for fixtures flagged
 * with `failFor: ['react', ...]` (test-generator.ts:797), so a matched-throw pair is
 * parity even if the prettier-emitted error messages drift in line numbers.
 */
function assertParity(component: JsonComponent, upstreamOut: Outcome, oursOut: Outcome) {
  if (upstreamOut.kind === 'throw' && oursOut.kind === 'throw') return;
  expect(oursOut).toEqual(upstreamOut);
  // suppress unused-component warning when both sides succeed
  void component;
}

function runReactParity(name: string, mode: Mode, options: Partial<ToReactOptions>) {
  const component = loadFixture(mode, name);
  const upstream = runOnce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c) => upstreamComponentToReact(options as any)({ component: c as any }),
    component,
  );
  const ours = runOnce((c) => ourComponentToReact(options)({ component: c }), component);
  assertParity(component, upstream, ours);
}

function runReactNativeParity(name: string, mode: Mode, options: Partial<ToReactNativeOptions>) {
  const component = loadFixture(mode, name);
  const upstream = runOnce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c) => upstreamComponentToReactNative(options as any)({ component: c as any }),
    component,
  );
  const ours = runOnce((c) => ourComponentToReactNative(options)({ component: c }), component);
  assertParity(component, upstream, ours);
}

/**
 * Runs both implementations against an in-memory `JsonComponent` (used for upstream's
 * hand-built test cases in `react-handbuilt.test.ts`, plus the `compileAwayPackages`
 * case which constructs its component via `parseJsx(..., { compileAwayPackages })`).
 */
function runReactParityComponent(component: JsonComponent, options: Partial<ToReactOptions>) {
  const upstream = runOnce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c) => upstreamComponentToReact(options as any)({ component: c as any }),
    component,
  );
  const ours = runOnce((c) => ourComponentToReact(options)({ component: c }), component);
  assertParity(component, upstream, ours);
}

// ──────────────────────────────────────────────────────────────────────────────
// Sweeps
// ──────────────────────────────────────────────────────────────────────────────

describe('parity vs @builder.io/mitosis', () => {
  // ── React, default options (Slice 4.2) ──────────────────────────────────────
  for (const mode of ['ts', 'js'] as const) {
    const fixtures = listFixtures(mode);
    if (fixtures.length === 0) continue;
    describe(`componentToReact / mode=${mode} / default options`, () => {
      for (const name of fixtures) {
        it(name, () => {
          runReactParity(name, mode, {});
        });
      }
    });
  }

  // ── React, stateType: 'variables' (mirrors upstream's react-state-variables) ─
  for (const mode of ['ts', 'js'] as const) {
    const fixtures = listFixtures(mode);
    if (fixtures.length === 0) continue;
    describe(`componentToReact / mode=${mode} / stateType=variables`, () => {
      for (const name of fixtures) {
        it(name, () => {
          runReactParity(name, mode, { stateType: 'variables' });
        });
      }
    });
  }

  // ── React Native, default options (mirrors upstream's react-native default) ──
  for (const mode of ['ts', 'js'] as const) {
    const fixtures = listFixtures(mode);
    if (fixtures.length === 0) continue;
    describe(`componentToReactNative / mode=${mode} / default options`, () => {
      for (const name of fixtures) {
        it(name, () => {
          runReactNativeParity(name, mode, {});
        });
      }
    });
  }

  // ── Inline tests from upstream's react.test.ts ───────────────────────────────
  describe('inline / componentToReact / react.test.ts', () => {
    it('stamped-io with stylesType=style-tag, stateType=useState', () => {
      runReactParity('blocks/stamped-io', 'ts', {
        stylesType: 'style-tag',
        stateType: 'useState',
      });
    });
    it('columns', () => {
      // upstream's `columns` test uses default options
      runReactParity('blocks/columns', 'ts', {});
    });
  });

  // ── Inline tests from upstream's react-native.test.ts ────────────────────────
  describe('inline / componentToReactNative / react-native.test.ts', () => {
    it('twrnc style', () => {
      runReactNativeParity('react-native/twrnc-styled-component', 'ts', { stylesType: 'twrnc' });
    });
    it('Vaild react-native styles (sanitizeReactNative)', () => {
      runReactNativeParity('react-native/native-styles', 'ts', { sanitizeReactNative: true });
    });
    it('twrnc state style', () => {
      runReactNativeParity('react-native/twrnc-state-styled-component', 'ts', {
        stylesType: 'twrnc',
      });
    });
    it('twrnc state complex style', () => {
      runReactNativeParity('react-native/twrnc-state-complex-styled-component', 'ts', {
        stylesType: 'twrnc',
      });
    });
    it('native-wind style', () => {
      runReactNativeParity('react-native/twrnc-styled-component', 'ts', {
        stylesType: 'native-wind',
      });
    });
  });

  // ── compileAwayPackages case from upstream's runTestsForTarget ───────────────
  // Re-parses the source with `compileAwayPackages: ['@dummy/custom-mitosis']`
  // — the only fixture that needs a non-default parser configuration. Upstream
  // runs this for each `runTestsForTarget` invocation when typescript=false
  // (test-generator.ts:773), once per target.
  describe('inline / componentToReact / Remove Internal mitosis package', () => {
    const src = readFileSync(
      resolve(UPSTREAM_DATA, 'basic-custom-mitosis-package.raw.tsx'),
      'utf8',
    );
    const filePath = 'src/__tests__/data/basic-custom-mitosis-package.raw.tsx';
    const component = upstreamParseJsx(src, {
      compileAwayPackages: ['@dummy/custom-mitosis'],
      filePath,
    }) as unknown as JsonComponent;

    it('default options', () => {
      runReactParityComponent(component, {});
    });
    it('stateType=variables', () => {
      runReactParityComponent(component, { stateType: 'variables' });
    });
  });

  // ── Hand-built JSON inputs from upstream's react-handbuilt.test.ts ───────────
  // Upstream's helpers `createMitosisComponent` / `createMitosisNode` /
  // `createSingleBinding` produce structurally identical objects to literal
  // JSON; we embed them as plain object literals here.
  describe('hand-built / componentToReact / react-handbuilt.test.ts', () => {
    it('renders a plain element with static text', () => {
      const component = handbuiltPlainElement();
      runReactParityComponent(component, {});
    });
    it('renders an expression-bound _text node', () => {
      const component = handbuiltExpressionText();
      runReactParityComponent(component, {});
    });
    it('rewrites state assignments to setState calls (stateType: useState)', () => {
      const component = handbuiltCounter();
      runReactParityComponent(component, { stateType: 'useState' });
    });
    it('emits a useEffect for onMount hooks', () => {
      const component = handbuiltMounter();
      runReactParityComponent(component, {});
    });
    it('emits useRef for declared refs', () => {
      const component = handbuiltWithRef();
      runReactParityComponent(component, {});
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Hand-built component fixtures (mirrors `react-handbuilt.test.ts`).
// ──────────────────────────────────────────────────────────────────────────────

const NODE_TYPE = '@builder.io/mitosis/node';
const COMP_TYPE = '@builder.io/mitosis/component';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handbuiltPlainElement(): any {
  return {
    '@type': COMP_TYPE,
    name: 'Hello',
    imports: [],
    exports: {},
    inputs: [],
    meta: {},
    refs: {},
    state: {},
    children: [
      {
        '@type': NODE_TYPE,
        name: 'div',
        properties: {},
        bindings: {},
        children: [
          {
            '@type': NODE_TYPE,
            name: '',
            properties: { _text: 'hello' },
            bindings: {},
            children: [],
          },
        ],
      },
    ],
    context: { get: {}, set: {} },
    subComponents: [],
    types: [],
    propsTypeRef: undefined,
    defaultProps: undefined,
    style: undefined,
    hooks: {},
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handbuiltExpressionText(): any {
  return {
    '@type': COMP_TYPE,
    name: 'Greeting',
    imports: [],
    exports: {},
    inputs: [],
    meta: {},
    refs: {},
    state: {},
    children: [
      {
        '@type': NODE_TYPE,
        name: 'span',
        properties: {},
        bindings: {},
        children: [
          {
            '@type': NODE_TYPE,
            name: '',
            properties: {},
            bindings: { _text: { type: 'single', code: 'props.name' } },
            children: [],
          },
        ],
      },
    ],
    context: { get: {}, set: {} },
    subComponents: [],
    types: [],
    hooks: {},
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handbuiltCounter(): any {
  return {
    '@type': COMP_TYPE,
    name: 'Counter',
    imports: [],
    exports: {},
    inputs: [],
    meta: {},
    refs: {},
    state: { count: { code: '0', type: 'property' } },
    children: [
      {
        '@type': NODE_TYPE,
        name: 'button',
        properties: {},
        bindings: {
          onClick: {
            type: 'single',
            bindingType: 'function',
            code: 'state.count = state.count + 1',
          },
        },
        children: [
          {
            '@type': NODE_TYPE,
            name: '',
            properties: { _text: 'inc' },
            bindings: {},
            children: [],
          },
        ],
      },
    ],
    context: { get: {}, set: {} },
    subComponents: [],
    types: [],
    hooks: {},
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handbuiltMounter(): any {
  return {
    '@type': COMP_TYPE,
    name: 'Mounter',
    imports: [],
    exports: {},
    inputs: [],
    meta: {},
    refs: {},
    state: {},
    children: [
      { '@type': NODE_TYPE, name: 'div', properties: {}, bindings: {}, children: [] },
    ],
    context: { get: {}, set: {} },
    subComponents: [],
    types: [],
    hooks: { onMount: [{ code: 'console.log("mounted")' }] },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handbuiltWithRef(): any {
  return {
    '@type': COMP_TYPE,
    name: 'WithRef',
    imports: [],
    exports: {},
    inputs: [],
    meta: {},
    refs: { inputRef: { argument: 'null' } },
    state: {},
    children: [
      {
        '@type': NODE_TYPE,
        name: 'input',
        properties: {},
        bindings: { ref: { type: 'single', code: 'inputRef' } },
        children: [],
      },
    ],
    context: { get: {}, set: {} },
    subComponents: [],
    types: [],
    hooks: {},
  };
}
