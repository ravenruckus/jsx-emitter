import { describe, expect, it } from 'vitest';
import { createNode } from '../src/internal/create-node';
import {
  closeFrag,
  getFragment,
  isFragmentWithKey,
  isReactForwardRef,
  openFrag,
  processBinding,
  processTagReferences,
  wrapInFragment,
} from '../src/internal/jsx-helpers';
import type { JsonComponent, JsonNode, ToReactOptions } from '../src/types';

const opts = (overrides: Partial<ToReactOptions> = {}): ToReactOptions => ({
  stylesType: 'styled-jsx',
  stateType: 'useState',
  type: 'dom',
  ...overrides,
});

const node = (overrides: Partial<JsonNode> = {}): JsonNode =>
  createNode({ ...overrides });

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

describe('processBinding', () => {
  it('strips state. prefix when stateType is useState', () => {
    expect(processBinding('state.foo', opts({ stateType: 'useState' }))).toBe('foo');
  });

  it('preserves props. prefix (only state. is stripped)', () => {
    expect(processBinding('props.bar + state.foo', opts({ stateType: 'useState' }))).toBe(
      'props.bar + foo',
    );
  });

  it('returns code unchanged when stateType is not useState (variables)', () => {
    expect(processBinding('state.foo', opts({ stateType: 'variables' }))).toBe('state.foo');
  });
});

describe('isFragmentWithKey', () => {
  it('returns true for a Fragment node with a key binding', () => {
    const n = node({
      name: 'Fragment',
      bindings: { key: { code: 'k1', type: 'single', bindingType: 'expression' } },
    });
    expect(isFragmentWithKey(n)).toBe(true);
  });

  it('returns false for a Fragment node without a key binding', () => {
    expect(isFragmentWithKey(node({ name: 'Fragment' }))).toBe(false);
  });

  it('returns false for a non-Fragment node', () => {
    const n = node({
      name: 'div',
      bindings: { key: { code: 'k1', type: 'single', bindingType: 'expression' } },
    });
    expect(isFragmentWithKey(n)).toBe(false);
  });

  it('returns false for undefined node', () => {
    expect(isFragmentWithKey(undefined)).toBe(false);
  });
});

describe('getFragment', () => {
  it('emits empty fragment shorthand when no node is supplied', () => {
    expect(getFragment('open', opts())).toBe('<>');
    expect(getFragment('close', opts())).toBe('</>');
  });

  it('emits React.Fragment with key when node is a Fragment with a key binding', () => {
    const n = node({
      name: 'Fragment',
      bindings: { key: { code: '"k1"', type: 'single', bindingType: 'expression' } },
    });
    expect(getFragment('open', opts(), n)).toBe('<React.Fragment key={"k1"}>');
    expect(getFragment('close', opts(), n)).toBe('</React.Fragment>');
  });

  it('processes the key code through processBinding (state. → bare ref)', () => {
    const n = node({
      name: 'Fragment',
      bindings: { key: { code: 'state.k', type: 'single', bindingType: 'expression' } },
    });
    expect(getFragment('open', opts({ stateType: 'useState' }), n)).toBe(
      '<React.Fragment key={k}>',
    );
  });

  it('emits empty fragment for a Fragment node with no key binding', () => {
    const n = node({ name: 'Fragment' });
    expect(getFragment('open', opts(), n)).toBe('<>');
    expect(getFragment('close', opts(), n)).toBe('</>');
  });
});

describe('openFrag / closeFrag', () => {
  it('openFrag delegates to getFragment("open", options)', () => {
    expect(openFrag(opts())).toBe('<>');
  });

  it('closeFrag delegates to getFragment("close", options)', () => {
    expect(closeFrag(opts())).toBe('</>');
  });
});

describe('wrapInFragment', () => {
  it('returns true when there are zero children', () => {
    expect(wrapInFragment(component())).toBe(true);
  });

  it('returns false when there is exactly one child', () => {
    expect(wrapInFragment(component({ children: [node()] }))).toBe(false);
  });

  it('returns true when there are multiple children', () => {
    expect(wrapInFragment(component({ children: [node(), node()] }))).toBe(true);
  });

  it('also accepts a JsonNode-shaped argument', () => {
    expect(wrapInFragment(node({ children: [node(), node()] }))).toBe(true);
    expect(wrapInFragment(node({ children: [node()] }))).toBe(false);
  });
});

describe('processTagReferences', () => {
  it('renames a state.<getter> tag to <Getter>Ref and emits an init hook constant', () => {
    const c = component({
      state: { foo: { code: 'function foo() { return Bar; }', type: 'getter' } },
      children: [node({ name: 'state.foo' })],
    });
    processTagReferences(c, opts());
    expect(c.children[0].name).toBe('FooRef');
    expect(c.hooks.init?.code).toContain('const FooRef = state.foo;');
  });

  it('only adds the init line once for repeated tags referencing the same state getter', () => {
    const c = component({
      state: { foo: { code: 'function foo() {}', type: 'getter' } },
      children: [node({ name: 'state.foo' }), node({ name: 'state.foo' })],
    });
    processTagReferences(c, opts());
    const matches = (c.hooks.init?.code ?? '').match(/const FooRef = state\.foo;/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('uppercases a state.<property> tag and rekeys state under the capitalized name', () => {
    const c = component({
      state: { foo: { code: '<Bar />', type: 'property' } },
      children: [node({ name: 'state.foo' })],
    });
    processTagReferences(c, opts());
    expect(c.children[0].name).toBe('Foo');
    expect(c.state.Foo).toBeDefined();
    expect(c.state.foo).toBeUndefined();
  });

  it('keeps a state.<property> tag with already-capitalized name unchanged in state map', () => {
    const c = component({
      state: { Foo: { code: '<Bar />', type: 'property' } },
      children: [node({ name: 'state.Foo' })],
    });
    processTagReferences(c, opts());
    expect(c.children[0].name).toBe('Foo');
    expect(c.state.Foo).toBeDefined();
  });

  it('runs processBinding (strips state.) on non-state-prefixed names', () => {
    const c = component({
      children: [node({ name: 'props.SomeTag' })],
    });
    processTagReferences(c, opts({ stateType: 'useState' }));
    expect(c.children[0].name).toBe('props.SomeTag');
  });

  it('preserves dashed (web-component) tag names verbatim', () => {
    const c = component({
      children: [node({ name: 'my-element' })],
    });
    processTagReferences(c, opts());
    expect(c.children[0].name).toBe('my-element');
  });
});

describe('isReactForwardRef', () => {
  it('returns the legacy useMetadata.forwardRef value', () => {
    const c = component({ meta: { useMetadata: { forwardRef: 'fr' } } });
    expect(isReactForwardRef(c)).toBe('fr');
  });

  it('returns the react.forwardRef value when the legacy field is absent', () => {
    const c = component({ meta: { useMetadata: { react: { forwardRef: 'fr2' } } } });
    expect(isReactForwardRef(c)).toBe('fr2');
  });

  it('legacy useMetadata.forwardRef wins over react.forwardRef', () => {
    const c = component({
      meta: { useMetadata: { forwardRef: 'a', react: { forwardRef: 'b' } } },
    });
    expect(isReactForwardRef(c)).toBe('a');
  });

  it('returns undefined when neither field is set', () => {
    expect(isReactForwardRef(component())).toBeUndefined();
  });
});
