import { types } from '@babel/core';
import generate from '@babel/generator';
import { describe, expect, it } from 'vitest';
import { createNode } from '../src/internal/create-node';
import {
  getSignalAccessPlugin,
  getSignalTypePlugin,
  replaceSignalSetters,
} from '../src/internal/plugins/process-signals';
import type { JsonComponent } from '../src/types';

const baseComponent = (overrides: Partial<JsonComponent> = {}): JsonComponent => ({
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

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('getSignalTypePlugin', () => {
  it('rewrites Signal<T> to T inside state CODE when used as a type annotation', () => {
    const json = baseComponent({
      signals: { signalTypeImportName: 'Signal' },
      state: {
        a: { code: 'value as Signal<number>', type: 'property' },
      },
    });
    getSignalTypePlugin()().json!.pre!(json);
    expect(norm(json.state.a!.code)).toContain('value as number');
    expect(json.state.a?.code).not.toMatch(/Signal</);
  });

  it('does not add imports for the React target', () => {
    const json = baseComponent({
      signals: { signalTypeImportName: 'Signal' },
      state: {
        a: { code: 'value as Signal<number>', type: 'property' },
      },
    });
    const importsBefore = json.imports.length;
    getSignalTypePlugin()().json!.pre!(json);
    expect(json.imports.length).toBe(importsBefore);
  });

  it('is a no-op when signalTypeImportName is not set', () => {
    const json = baseComponent({
      state: { a: { code: 'value as Signal<number>', type: 'property' } },
    });
    getSignalTypePlugin()().json!.pre!(json);
    expect(json.state.a?.code).toMatch(/Signal</);
  });

  it('skips dynamic-jsx-elements processing (does not parse node names as code)', () => {
    const node = createNode({ name: 'Foo' });
    const json = baseComponent({
      signals: { signalTypeImportName: 'Signal' },
      children: [node],
    });
    expect(() => getSignalTypePlugin()().json!.pre!(json)).not.toThrow();
    expect(json.children[0].name).toBe('Foo');
  });
});

describe('getSignalAccessPlugin', () => {
  it('replaces props.x.value with props.x when prop is reactive', () => {
    const node = createNode({
      bindings: {
        v: { code: 'props.x.value', type: 'single', bindingType: 'expression' },
      },
    });
    const json = baseComponent({
      props: {
        x: { propertyType: 'reactive', optional: false },
      },
      children: [node],
    });
    getSignalAccessPlugin()().json!.pre!(json);
    expect(norm(json.children[0].bindings.v!.code)).toBe('props.x');
  });

  it('rewrites props.x?.value optional access too', () => {
    const node = createNode({
      bindings: {
        v: { code: 'props.x?.value', type: 'single', bindingType: 'expression' },
      },
    });
    const json = baseComponent({
      props: { x: { propertyType: 'reactive', optional: true } },
      children: [node],
    });
    getSignalAccessPlugin()().json!.pre!(json);
    expect(norm(json.children[0].bindings.v!.code)).toBe('props.x');
  });

  it('replaces props.x.value.field = newVal with props.setX(prev => ...)', () => {
    // The setter rewrite only fires for nested-field assignments (a.b.c.value.d = e).
    // Top-level assignments (a.b.value = e) fall through to the getter rewrite.
    const node = createNode({
      bindings: {
        v: {
          code: 'props.x.value.field = newVal',
          type: 'single',
          bindingType: 'function',
        },
      },
    });
    const json = baseComponent({
      props: { x: { propertyType: 'reactive', optional: false } },
      children: [node],
    });
    getSignalAccessPlugin()().json!.pre!(json);
    const code = norm(json.children[0].bindings.v!.code);
    expect(code).toContain('props.setX(');
    expect(code).toContain('PREVIOUS_VALUE');
  });

  it('replaces state.x.value with state.x when state is reactive', () => {
    const node = createNode({
      bindings: {
        v: { code: 'state.counter.value', type: 'single', bindingType: 'expression' },
      },
    });
    const json = baseComponent({
      state: { counter: { code: '0', type: 'property', propertyType: 'reactive' } },
      children: [node],
    });
    getSignalAccessPlugin()().json!.pre!(json);
    expect(norm(json.children[0].bindings.v!.code)).toBe('state.counter');
  });

  it('replaces context.x.value with x getter for reactive context entries', () => {
    const node = createNode({
      bindings: {
        v: { code: 'theCtx.value', type: 'single', bindingType: 'expression' },
      },
    });
    const json = baseComponent({
      context: {
        get: { theCtx: { name: 'TheCtx', path: 'pkg', type: 'reactive' } },
        set: {},
      },
      children: [node],
    });
    getSignalAccessPlugin()().json!.pre!(json);
    expect(norm(json.children[0].bindings.v!.code)).toBe('theCtx');
  });

  it('does not rewrite non-reactive props', () => {
    const node = createNode({
      bindings: {
        v: { code: 'props.x.value', type: 'single', bindingType: 'expression' },
      },
    });
    const json = baseComponent({
      props: { x: { propertyType: 'normal', optional: false } },
      children: [node],
    });
    getSignalAccessPlugin()().json!.pre!(json);
    expect(norm(json.children[0].bindings.v!.code)).toBe('props.x.value');
  });
});

describe('replaceSignalSetters', () => {
  it('rewrites a.b.c.value.d = e into a.b.setC(prev => ({ ...prev, d: e }))', () => {
    const code = 'props.x.value.d = newVal';
    // `from` is the parent of the assignment LHS (props.x.value), not just props.x.
    const from = types.memberExpression(
      types.memberExpression(types.identifier('props'), types.identifier('x')),
      types.identifier('value'),
    );
    const setTo = types.memberExpression(types.identifier('props'), types.identifier('setX'));
    const result = replaceSignalSetters({ code, nodeMaps: [{ from, setTo }] });
    expect(result).toContain('props.setX(');
    expect(result).toContain('PREVIOUS_VALUE');
  });

  it('leaves non-matching assignments alone', () => {
    const code = 'props.other.value.d = 1';
    const from = types.memberExpression(
      types.memberExpression(types.identifier('props'), types.identifier('x')),
      types.identifier('value'),
    );
    const setTo = types.memberExpression(types.identifier('props'), types.identifier('setX'));
    const result = replaceSignalSetters({ code, nodeMaps: [{ from, setTo }] });
    expect(result).not.toContain('setX');
  });

  it('uses @babel/generator to drive AST-level matching (sanity)', () => {
    // round-trip a small AST shape through @babel/generator
    const code = generate(types.identifier('x')).code;
    expect(code).toBe('x');
  });
});
