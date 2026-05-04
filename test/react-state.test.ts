import { describe, expect, it } from 'vitest';
import { createNode } from '../src/internal/create-node';
import {
  getDefaultImport,
  getReactVariantStateImportString,
  getReactVariantStateString,
  getUseStateCode,
  processHookCode,
  updateStateSetters,
  updateStateSettersInCode,
} from '../src/internal/state';
import type { JsonComponent, JsonNode, ToReactOptions } from '../src/types';

const opts = (overrides: Partial<ToReactOptions> = {}): ToReactOptions => ({
  stylesType: 'styled-jsx',
  stateType: 'useState',
  type: 'dom',
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

const node = (overrides: Partial<JsonNode> = {}): JsonNode => createNode(overrides);

describe('processHookCode', () => {
  it('rewrites state setters and strips state. prefixes when stateType is useState', () => {
    const out = processHookCode({ str: 'state.foo = 1', options: opts({ stateType: 'useState' }) });
    expect(out).toContain('setFoo(1)');
    expect(out).not.toMatch(/state\.foo\s*=/);
  });

  it('returns code unchanged when stateType is variables', () => {
    expect(
      processHookCode({ str: 'state.foo = 1', options: opts({ stateType: 'variables' }) }),
    ).toBe('state.foo = 1');
  });
});

describe('updateStateSettersInCode', () => {
  it('rewrites state.foo = bar to setFoo(bar) when stateType is useState', () => {
    const out = updateStateSettersInCode('state.foo = bar', opts({ stateType: 'useState' }));
    expect(out).toContain('setFoo(bar)');
  });

  it('returns input unchanged when stateType is variables', () => {
    expect(updateStateSettersInCode('state.foo = 1', opts({ stateType: 'variables' }))).toBe(
      'state.foo = 1',
    );
  });
});

describe('updateStateSetters', () => {
  it('rewrites bindings code in every JsonNode child when stateType is useState', () => {
    const c = component({
      children: [
        node({
          bindings: {
            onClick: { code: 'state.x = 1', type: 'single', bindingType: 'function' },
          },
        }),
      ],
    });
    updateStateSetters(c, opts({ stateType: 'useState' }));
    expect(c.children[0].bindings.onClick?.code).toContain('setX(1)');
  });

  it('does not modify bindings when stateType is variables', () => {
    const c = component({
      children: [
        node({
          bindings: {
            onClick: { code: 'state.x = 1', type: 'single', bindingType: 'function' },
          },
        }),
      ],
    });
    updateStateSetters(c, opts({ stateType: 'variables' }));
    expect(c.children[0].bindings.onClick?.code).toBe('state.x = 1');
  });
});

describe('getUseStateCode', () => {
  it('emits a useState declaration for each property entry', () => {
    const c = component({
      state: {
        count: { code: '0', type: 'property' },
        name: { code: '"abc"', type: 'property' },
      },
    });
    const out = getUseStateCode(c, opts({ stateType: 'useState' }));
    expect(out).toMatch(/const \[count, setCount\] = useState\(\(\) => \(0\)\)/);
    expect(out).toMatch(/const \[name, setName\] = useState\(\(\) => \("abc"\)\)/);
  });

  it('uses TypeScript type parameter when typescript and typeParameter are set', () => {
    const c = component({
      state: { count: { code: '0', type: 'property', typeParameter: 'number' } },
    });
    const out = getUseStateCode(c, opts({ stateType: 'useState', typescript: true }));
    expect(out).toContain('useState<number>(() => (0))');
  });

  it('emits a function declaration prefixed with `function` for method state', () => {
    const c = component({
      state: { add: { code: 'add(a, b) { return a + b; }', type: 'method' } },
    });
    const out = getUseStateCode(c, opts({ stateType: 'useState' }));
    expect(out).toContain('function add(a, b)');
  });

  it('rewrites a getter to a function via replaceGetterWithFunction', () => {
    const c = component({
      state: { value: { code: 'get value() { return state.x; }', type: 'getter' } },
    });
    const out = getUseStateCode(c, opts({ stateType: 'useState' }));
    expect(out).toContain('function value()');
  });

  it('returns empty value strings for missing state entries (filtered to "")', () => {
    const c = component({ state: { skip: undefined } });
    const out = getUseStateCode(c, opts({ stateType: 'useState' }));
    expect(out).toBe('');
  });
});

describe('getReactVariantStateImportString', () => {
  it('always returns empty string after slim (useState/variables need no extra import)', () => {
    expect(getReactVariantStateImportString(true, opts({ stateType: 'useState' }))).toBe('');
    expect(getReactVariantStateImportString(true, opts({ stateType: 'variables' }))).toBe('');
    expect(getReactVariantStateImportString(false, opts({ stateType: 'useState' }))).toBe('');
  });
});

describe('getReactVariantStateString', () => {
  it('returns the useStateCode when stateType is useState and hasState is true', () => {
    const c = component();
    expect(
      getReactVariantStateString({
        hasState: true,
        options: opts({ stateType: 'useState' }),
        json: c,
        useStateCode: 'const [x, setX] = useState(0);',
      }),
    ).toBe('const [x, setX] = useState(0);');
  });

  it('returns empty string when hasState is false', () => {
    expect(
      getReactVariantStateString({
        hasState: false,
        options: opts({ stateType: 'useState' }),
        json: component(),
        useStateCode: 'whatever',
      }),
    ).toBe('');
  });

  it('emits variable declarations for stateType=variables', () => {
    const c = component({
      state: {
        count: { code: '0', type: 'property' },
        helper: { code: 'helper() { return 1; }', type: 'method' },
      },
    });
    const out = getReactVariantStateString({
      hasState: true,
      options: opts({ stateType: 'variables' }),
      json: c,
      useStateCode: '',
    });
    expect(out).toMatch(/const\s+count\s*=\s*0/);
    expect(out).toContain('function helper');
  });

  it('emits a getter as a function (strips `get ` prefix) for stateType=variables', () => {
    const c = component({
      state: { value: { code: 'get value() { return 1; }', type: 'getter' } },
    });
    const out = getReactVariantStateString({
      hasState: true,
      options: opts({ stateType: 'variables' }),
      json: c,
      useStateCode: '',
    });
    expect(out).toContain('function value()');
    expect(out).not.toMatch(/^get value/);
  });

  it('preserves async functions verbatim for stateType=variables', () => {
    const c = component({
      state: { load: { code: 'async load() { return 1; }', type: 'function' } },
    });
    const out = getReactVariantStateString({
      hasState: true,
      options: opts({ stateType: 'variables' }),
      json: c,
      useStateCode: '',
    });
    expect(out).toContain('async load()');
  });
});

describe('getDefaultImport', () => {
  it('returns the standard React import for type=dom', () => {
    expect(getDefaultImport(opts({ type: 'dom' }), component())).toBe(
      "import * as React from 'react';",
    );
  });

  it('returns React-only import for type=taro (no react-native imports)', () => {
    const out = getDefaultImport(opts({ type: 'taro' }), component());
    expect(out).toContain("import * as React from 'react';");
    expect(out).not.toMatch(/from 'react-native'/);
  });

  it('emits react-native imports for component names actually used (type=native)', () => {
    const c = component({
      children: [node({ name: 'View', children: [node({ name: 'Text' })] })],
    });
    const out = getDefaultImport(opts({ type: 'native' }), c);
    expect(out).toContain("import * as React from 'react';");
    expect(out).toMatch(/import \{[^}]*View[^}]*Text[^}]*\} from 'react-native'/);
  });

  it('adds Text to the react-native import list when a node uses _text properties', () => {
    const c = component({
      children: [node({ name: 'View', properties: { _text: 'hello' } })],
    });
    const out = getDefaultImport(opts({ type: 'native' }), c);
    expect(out).toMatch(/import \{[^}]*Text[^}]*\} from 'react-native'/);
  });

  it('adds StyleSheet when a node has style', () => {
    const c = component({
      children: [node({ name: 'View', properties: { style: '{}' } })],
    });
    const out = getDefaultImport(opts({ type: 'native' }), c);
    expect(out).toMatch(/import \{[^}]*StyleSheet[^}]*\} from 'react-native'/);
  });

  it('adds Linking when TouchableOpacity has an href binding', () => {
    const c = component({
      children: [
        node({
          name: 'TouchableOpacity',
          bindings: { href: { code: '"/"', type: 'single', bindingType: 'expression' } },
        }),
      ],
    });
    const out = getDefaultImport(opts({ type: 'native' }), c);
    expect(out).toMatch(/import \{[^}]*Linking[^}]*\} from 'react-native'/);
  });

  it('skips a name from react-native if it is already imported elsewhere', () => {
    const c = component({
      imports: [{ path: 'custom-pkg', imports: { View: 'View' } }],
      children: [node({ name: 'View' })],
    });
    const out = getDefaultImport(opts({ type: 'native' }), c);
    expect(out).not.toMatch(/import \{[^}]*View[^}]*\} from 'react-native'/);
  });
});
