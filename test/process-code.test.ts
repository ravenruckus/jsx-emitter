import { describe, expect, it, vi } from 'vitest';
import { createNode } from '../src/internal/create-node';
import {
  CODE_PROCESSOR_PLUGIN,
  createCodeProcessorPlugin,
} from '../src/internal/plugins/process-code';
import type { CodeProcessor, CodeType } from '../src/internal/plugins/process-code/types';
import type { JsonComponent, OnEventHook, OnMountHook } from '../src/types';

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

const onMount = (overrides: Partial<OnMountHook> = {}): OnMountHook => ({
  code: 'onMount',
  ...overrides,
});

const onEvent = (overrides: Partial<OnEventHook> = {}): OnEventHook => ({
  code: 'onEvent',
  refName: 'r',
  eventName: 'click',
  isRoot: false,
  eventArgName: 'event',
  ...overrides,
});

describe('createCodeProcessorPlugin', () => {
  it('rewrites every state code, returning string from processor', () => {
    const json = baseComponent({
      state: {
        a: { code: 'foo', type: 'property' },
        b: { code: 'bar', type: 'property' },
      },
    });
    const upper: CodeProcessor = () => (code) => code.toUpperCase();
    createCodeProcessorPlugin(upper)(json);
    expect(json.state.a?.code).toBe('FOO');
    expect(json.state.b?.code).toBe('BAR');
  });

  it('invokes the side-effect callback when processor returns a function', () => {
    const json = baseComponent({
      state: { a: { code: 'foo', type: 'property' } },
    });
    const sideEffect = vi.fn();
    const proc: CodeProcessor = () => () => sideEffect;
    createCodeProcessorPlugin(proc)(json);
    expect(sideEffect).toHaveBeenCalledOnce();
    // string was not assigned because the processor returned a function
    expect(json.state.a?.code).toBe('foo');
  });

  it('walks each scalar onMount hook and rewrites code', () => {
    const json = baseComponent({
      hooks: {
        onMount: [onMount({ code: 'm1' }), onMount({ code: 'm2' })],
        onEvent: [],
      },
    });
    const tag: CodeProcessor = (codeType) => (code, key) => `<${codeType}:${key}>${code}`;
    createCodeProcessorPlugin(tag)(json);
    expect(json.hooks.onMount[0].code).toBe('<hooks:onMount>m1');
    expect(json.hooks.onMount[1].code).toBe('<hooks:onMount>m2');
  });

  it('rewrites scalar `init` hook code', () => {
    const json = baseComponent({
      hooks: { onMount: [], onEvent: [], init: { code: 'doInit' } },
    });
    const upper: CodeProcessor = () => (code) => code.toUpperCase();
    createCodeProcessorPlugin(upper)(json);
    expect(json.hooks.init?.code).toBe('DOINIT');
  });

  it('rewrites `onEvent.deps` and filters empty depsArray entries', () => {
    const json = baseComponent({
      hooks: {
        onMount: [],
        onEvent: [
          onEvent({
            code: 'evt',
            depsArray: ['a', 'b', 'c'],
          }),
        ],
        onUpdate: [
          { code: 'u', deps: 'old', depsArray: ['x', 'y'] },
        ],
      },
    });
    const proc: CodeProcessor = (codeType) => (code) => {
      if (codeType === 'hooks-deps') return 'newDeps';
      if (codeType === 'hooks-deps-array') return code === 'b' ? '' : code.toUpperCase();
      return code;
    };
    createCodeProcessorPlugin(proc)(json);
    expect(json.hooks.onEvent[0].depsArray).toEqual(['A', 'C']);
    expect(json.hooks.onUpdate?.[0].deps).toBe('newDeps');
    expect(json.hooks.onUpdate?.[0].depsArray).toEqual(['X', 'Y']);
  });

  it('rewrites state.typeParameter under codeType "types"', () => {
    const json = baseComponent({
      state: { a: { code: '0', type: 'property', typeParameter: 'T' } },
    });
    const proc: CodeProcessor = (codeType) => (code) => `${codeType}:${code}`;
    createCodeProcessorPlugin(proc)(json);
    expect(json.state.a?.typeParameter).toBe('types:T');
    expect(json.state.a?.code).toBe('state:0');
  });

  it('rewrites context.set ref + value entries under codeType "context-set"', () => {
    const json = baseComponent({
      context: {
        get: {},
        set: {
          ctxA: {
            name: 'CtxA',
            ref: 'theRef',
            value: { v: { code: 'val', type: 'property' } },
          },
        },
      },
    });
    const proc: CodeProcessor = (codeType) => (code) => `<${codeType}>${code}`;
    createCodeProcessorPlugin(proc)(json);
    expect(json.context.set.ctxA.ref).toBe('<context-set>theRef');
    expect(json.context.set.ctxA.value?.v?.code).toBe('<context-set>val');
  });

  it('walks bindings on every node', () => {
    const root = createNode({
      name: 'div',
      bindings: {
        onClick: { code: 'handle()', type: 'single', bindingType: 'function' },
      },
      children: [
        createNode({
          name: 'span',
          bindings: {
            value: { code: 'x', type: 'single', bindingType: 'expression' },
          },
        }),
      ],
    });
    const json = baseComponent({ children: [root] });
    const proc: CodeProcessor = (codeType) => (code) => {
      expect(codeType).toBeTypeOf('string');
      return `[${code}]`;
    };
    createCodeProcessorPlugin(proc)(json);
    expect(json.children[0].bindings.onClick?.code).toBe('[handle()]');
    expect(json.children[0].children[0].bindings.value?.code).toBe('[x]');
  });

  it('does not rewrite properties unless processProperties is true', () => {
    const node = createNode({
      properties: { class: 'foo' },
    });
    const json = baseComponent({ children: [node] });
    const proc: CodeProcessor = () => (code) => code.toUpperCase();
    createCodeProcessorPlugin(proc)(json);
    expect(json.children[0].properties.class).toBe('foo');
  });

  it('rewrites properties when processProperties is true (skips _text)', () => {
    const node = createNode({
      properties: { class: 'foo', _text: 'hello' },
    });
    const json = baseComponent({ children: [node] });
    const proc: CodeProcessor = () => (code) => code.toUpperCase();
    createCodeProcessorPlugin(proc, { processProperties: true })(json);
    expect(json.children[0].properties.class).toBe('FOO');
    expect(json.children[0].properties._text).toBe('hello');
  });

  it('emits dynamic-jsx-elements processing for nodes whose name has no dash', () => {
    const node = createNode({ name: 'state.foo' });
    const json = baseComponent({ children: [node] });
    const seen: CodeType[] = [];
    const proc: CodeProcessor = (codeType) => (code) => {
      seen.push(codeType);
      return code;
    };
    createCodeProcessorPlugin(proc)(json);
    expect(seen).toContain('dynamic-jsx-elements');
  });

  it('skips dynamic-jsx-elements processing for dashed names', () => {
    const node = createNode({ name: 'swiper-container' });
    const json = baseComponent({ children: [node] });
    const seen: CodeType[] = [];
    const proc: CodeProcessor = (codeType) => (code) => {
      seen.push(codeType);
      return code;
    };
    createCodeProcessorPlugin(proc)(json);
    expect(seen).not.toContain('dynamic-jsx-elements');
  });

  it('rewrites types[] and propsTypeRef under codeType "types"', () => {
    const json = baseComponent({
      types: ['T1', 'T2'],
      propsTypeRef: 'Props',
    });
    const proc: CodeProcessor = (codeType) => (code) => `${codeType}:${code}`;
    createCodeProcessorPlugin(proc)(json);
    expect(json.types).toEqual(['types:T1', 'types:T2']);
    expect(json.propsTypeRef).toBe('types:Props');
  });

  it('returns the original type when types[] processor returns a function (side effect)', () => {
    const json = baseComponent({ types: ['T1'] });
    const sideEffect = vi.fn();
    const proc: CodeProcessor = () => () => sideEffect;
    createCodeProcessorPlugin(proc)(json);
    expect(sideEffect).toHaveBeenCalled();
    expect(json.types).toEqual(['T1']);
  });
});

describe('CODE_PROCESSOR_PLUGIN', () => {
  it('returns a Plugin whose json.post is the processor application', () => {
    const json = baseComponent({ name: 'A', state: { a: { code: 'foo', type: 'property' } } });
    const proc: CodeProcessor = () => (code) => code.toUpperCase();
    const plugin = CODE_PROCESSOR_PLUGIN(proc);
    const post = plugin().json?.post;
    expect(post).toBeDefined();
    post!(json);
    expect(json.state.a?.code).toBe('FOO');
  });
});
