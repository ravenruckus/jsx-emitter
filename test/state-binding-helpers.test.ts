import { describe, expect, it } from 'vitest';
import { createSingleBinding } from '../src/internal/bindings';
import { checkHasState } from '../src/internal/check-has-state';
import { getFunctionString } from '../src/internal/get-function-string';
import { getPropsRef } from '../src/internal/get-props-ref';
import { getRefs } from '../src/internal/get-refs';
import {
  getMemberObjectString,
  getStateObjectStringFromComponent,
  stringifyContextValue,
} from '../src/internal/get-state-object-string';
import { getStateUsed } from '../src/internal/get-state-used';
import { getTypedFunction } from '../src/internal/get-typed-function';
import { gettersToFunctions } from '../src/internal/getters-to-functions';
import { handleMissingState } from '../src/internal/handle-missing-state';
import { mapRefs } from '../src/internal/map-refs';
import {
  getOnEventHandlerName,
  getOnEventHooksForNode,
  processOnEventHooksPlugin,
} from '../src/internal/on-event';
import { processHttpRequests } from '../src/internal/process-http-requests';
import { stripMetaProperties } from '../src/internal/strip-meta-properties';
import type { JsonComponent, JsonNode, OnEventHook } from '../src/types';

const node = (overrides: Partial<JsonNode> = {}): JsonNode => ({
  '@type': 'jsx-emitter/node',
  meta: {},
  name: 'div',
  scope: {},
  properties: {},
  bindings: {},
  children: [],
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

describe('getFunctionString', () => {
  it('passes through code that already starts with `function`', () => {
    expect(getFunctionString('function foo() {}')).toBe('function foo() {}');
  });
  it('prefixes `function ` when missing', () => {
    expect(getFunctionString('foo() {}')).toBe('function foo() {}');
  });
});

describe('getTypedFunction', () => {
  it('returns code unchanged when typescript is false', () => {
    expect(getTypedFunction('foo() { return 1; }', false, 'T')).toBe('foo() { return 1; }');
  });
  it('returns code unchanged when no typeParameter', () => {
    expect(getTypedFunction('foo() { return 1; }', true, undefined)).toBe('foo() { return 1; }');
  });
  it('returns code unchanged when no `{` in code', () => {
    expect(getTypedFunction('foo()', true, 'T')).toBe('foo()');
  });
  it('inserts a `: ReturnType<T>` annotation before the body', () => {
    expect(getTypedFunction('foo() { return 1; }', true, 'T')).toBe(
      'foo(): ReturnType<T>{ return 1; }',
    );
  });
});

describe('createSingleBinding', () => {
  it('defaults bindingType to expression', () => {
    expect(createSingleBinding({ code: 'foo' })).toEqual({
      code: 'foo',
      type: 'single',
      bindingType: 'expression',
    });
  });
  it('honors caller-provided bindingType', () => {
    expect(createSingleBinding({ code: 'foo()', bindingType: 'function' })).toEqual({
      code: 'foo()',
      type: 'single',
      bindingType: 'function',
    });
  });
});

describe('checkHasState', () => {
  it('returns false for empty state', () => {
    expect(checkHasState(component())).toBe(false);
  });
  it('returns true when state has any keys', () => {
    expect(
      checkHasState(component({ state: { x: { code: '1', type: 'property' } } })),
    ).toBe(true);
  });
});

describe('getRefs', () => {
  it('collects ref binding code from all nodes', () => {
    const c = component({
      children: [
        node({ bindings: { ref: { code: 'firstRef', type: 'single', bindingType: 'expression' } } }),
        node({
          children: [
            node({
              bindings: { ref: { code: 'nestedRef', type: 'single', bindingType: 'expression' } },
            }),
          ],
        }),
      ],
    });
    expect(getRefs(c)).toEqual(new Set(['firstRef', 'nestedRef']));
  });
  it('honors a custom refKey', () => {
    const c = component({
      children: [
        node({ bindings: { customRef: { code: 'r', type: 'single', bindingType: 'expression' } } }),
      ],
    });
    expect(getRefs(c, 'customRef')).toEqual(new Set(['r']));
  });
});

describe('getPropsRef', () => {
  it('matches props.<name>', () => {
    const c = component({
      children: [
        node({ bindings: { ref: { code: 'props.outer', type: 'single', bindingType: 'expression' } } }),
      ],
    });
    expect(getPropsRef(c)).toEqual(['outer', true]);
  });
  it('returns ["", false] when no props.<x> binding', () => {
    const c = component({
      children: [node({ bindings: { ref: { code: 'localRef', type: 'single', bindingType: 'expression' } } })],
    });
    expect(getPropsRef(c)).toEqual(['', false]);
  });
  it('removes the binding when shouldRemove=true', () => {
    const target = node({ bindings: { ref: { code: 'props.x', type: 'single', bindingType: 'expression' } } });
    const c = component({ children: [target] });
    getPropsRef(c, true);
    expect(target.bindings.ref).toBeUndefined();
  });
});

describe('getStateUsed', () => {
  it('finds state.<x> references in any string in the component tree', () => {
    const c = component({
      hooks: { onMount: [{ code: 'state.foo + state.bar' }], onEvent: [] },
    });
    expect(getStateUsed(c)).toEqual(new Set(['foo', 'bar']));
  });
});

describe('gettersToFunctions', () => {
  it('rewrites state.<getter> to <getter>() in code strings', () => {
    const c = component({
      state: { foo: { code: 'return 1;', type: 'getter' } },
      hooks: { onMount: [{ code: 'state.foo + 2' }], onEvent: [] },
    });
    gettersToFunctions(c);
    expect(c.hooks.onMount[0].code).toBe('foo() + 2');
  });
});

describe('handleMissingState', () => {
  it('adds null property entries for state.<x> references not in state', () => {
    const c = component({
      hooks: { onMount: [{ code: 'state.absent' }], onEvent: [] },
    });
    handleMissingState(c);
    expect(c.state.absent).toEqual({ code: 'null', type: 'property', propertyType: 'normal' });
  });
});

describe('processHttpRequests', () => {
  it('adds onMount hooks for each httpRequests entry', () => {
    const c = component({
      meta: { useMetadata: { httpRequests: { items: '/api/items' } } },
    });
    processHttpRequests(c);
    expect(c.state.items).toEqual({ code: 'null', type: 'property', propertyType: 'normal' });
    expect(c.hooks.onMount).toHaveLength(1);
    expect(c.hooks.onMount[0].code).toMatch(/fetch\("\/api\/items"\)/);
    expect(c.hooks.onMount[0].code).toMatch(/state\.items = result/);
  });
});

describe('stripMetaProperties', () => {
  it('removes $-prefixed properties and bindings from every node', () => {
    const child = node({
      properties: { $internal: 'x', kept: 'y' },
      bindings: {
        $secret: { code: 's', type: 'single', bindingType: 'expression' },
        kept: { code: 'k', type: 'single', bindingType: 'expression' },
      },
    });
    stripMetaProperties(component({ children: [child] }));
    expect(child.properties.$internal).toBeUndefined();
    expect(child.properties.kept).toBe('y');
    expect(child.bindings.$secret).toBeUndefined();
    expect(child.bindings.kept).toBeDefined();
  });
});

describe('getMemberObjectString', () => {
  it('produces an object literal by default', () => {
    const out = getMemberObjectString({
      foo: { code: '1', type: 'property' },
    });
    expect(out).toMatch(/^\{/);
    expect(out).toMatch(/foo: 1/);
    expect(out).toMatch(/\}$/);
  });
  it('returns an empty object when there are no entries', () => {
    expect(getMemberObjectString({})).toBe('{}');
  });
  it('format=variables produces variable-style output without braces', () => {
    const out = getMemberObjectString(
      { x: { code: '1', type: 'property' } },
      { format: 'variables', keyPrefix: 'let' },
    );
    expect(out).not.toMatch(/^\{/);
    expect(out).toMatch(/let x= 1/);
  });
  it('respects withType when typeParameter is set', () => {
    const out = getMemberObjectString({
      x: { code: '1', type: 'property', typeParameter: 'number' },
    }, { withType: true });
    expect(out).toMatch(/x:number/);
  });
  it('skips data when data=false', () => {
    expect(
      getMemberObjectString({ x: { code: '1', type: 'property' } }, { data: false }),
    ).toBe('{}');
  });
  it('skips functions when functions=false', () => {
    expect(
      getMemberObjectString(
        { f: { code: '() => 1', type: 'function' } },
        { functions: false },
      ),
    ).toBe('{}');
  });
  it('skips getters when getters=false', () => {
    expect(
      getMemberObjectString(
        { g: { code: 'get g() { return 1; }', type: 'getter' } },
        { getters: false },
      ),
    ).toBe('{}');
  });
});

describe('getStateObjectStringFromComponent', () => {
  it('routes through getMemberObjectString on the component state', () => {
    const c = component({ state: { x: { code: '1', type: 'property' } } });
    expect(getStateObjectStringFromComponent(c)).toMatch(/x: 1/);
  });
});

describe('stringifyContextValue', () => {
  it('routes through getMemberObjectString', () => {
    expect(stringifyContextValue({ x: { code: '1', type: 'property' } })).toMatch(/x: 1/);
  });
});

describe('mapRefs', () => {
  it('rewrites ref identifiers in node bindings via the mapper', () => {
    const target = node({
      bindings: {
        ref: { code: 'myRef', type: 'single', bindingType: 'expression' },
        other: { code: 'myRef + 1', type: 'single', bindingType: 'expression' },
      },
    });
    const c = component({ children: [target] });
    mapRefs(c, (refName) => `${refName}.current`);
    expect(target.bindings.other!.code).toMatch(/myRef\.current/);
  });
  it('rewrites ref identifiers inside hook code', () => {
    const c = component({
      children: [
        node({
          bindings: { ref: { code: 'myRef', type: 'single', bindingType: 'expression' } },
        }),
      ],
      hooks: { onMount: [{ code: 'myRef.focus();' }], onEvent: [] },
    });
    mapRefs(c, (refName) => `${refName}.current`);
    expect(c.hooks.onMount[0].code).toMatch(/myRef\.current\.focus/);
  });
  it('rewrites ref identifiers in component.refs even without bindings', () => {
    const c = component({
      refs: { soloRef: { argument: 'null' } },
      hooks: { onMount: [{ code: 'soloRef.focus();' }], onEvent: [] },
    });
    mapRefs(c, (refName) => `${refName}.current`);
    expect(c.hooks.onMount[0].code).toMatch(/soloRef\.current/);
  });
});

describe('on-event helpers', () => {
  const hook = (overrides: Partial<OnEventHook> = {}): OnEventHook => ({
    refName: 'btnRef',
    eventName: 'click',
    isRoot: false,
    eventArgName: 'event',
    code: 'console.log("clicked")',
    ...overrides,
  });

  it('getOnEventHandlerName combines refName + capitalized eventName', () => {
    expect(getOnEventHandlerName(hook())).toBe('btnRef_onClick');
  });

  it('getOnEventHooksForNode matches the node bindings.ref to hook.refName', () => {
    const target = node({
      bindings: { ref: { code: 'btnRef', type: 'single', bindingType: 'expression' } },
    });
    const other = node({
      bindings: { ref: { code: 'otherRef', type: 'single', bindingType: 'expression' } },
    });
    const c = component({
      children: [target, other],
      hooks: { onMount: [], onEvent: [hook()] },
    });
    expect(getOnEventHooksForNode({ node: target, component: c })).toHaveLength(1);
    expect(getOnEventHooksForNode({ node: other, component: c })).toHaveLength(0);
  });

  it('processOnEventHooksPlugin attaches handlers to state and node bindings', () => {
    const target = node({
      bindings: { ref: { code: 'btnRef', type: 'single', bindingType: 'expression' } },
    });
    const c = component({
      children: [target],
      hooks: { onMount: [], onEvent: [hook()] },
    });
    const plugin = processOnEventHooksPlugin()();
    plugin.json!.pre!(c);
    expect(c.state.btnRef_onClick).toBeDefined();
    expect(c.state.btnRef_onClick!.type).toBe('method');
    expect(target.bindings.onClick).toBeDefined();
    expect(target.bindings.onClick!.code).toBe('state.btnRef_onClick(event)');
  });

  it('processOnEventHooksPlugin honors includeRootEvents=false', () => {
    const target = node({
      bindings: { ref: { code: 'btnRef', type: 'single', bindingType: 'expression' } },
    });
    const c = component({
      children: [target],
      hooks: { onMount: [], onEvent: [hook({ isRoot: true })] },
    });
    processOnEventHooksPlugin({ includeRootEvents: false })().json!.pre!(c);
    expect(c.state.btnRef_onClick).toBeUndefined();
    expect(target.bindings.onClick).toBeUndefined();
  });

  it('processOnEventHooksPlugin honors setBindings=false', () => {
    const target = node({
      bindings: { ref: { code: 'btnRef', type: 'single', bindingType: 'expression' } },
    });
    const c = component({
      children: [target],
      hooks: { onMount: [], onEvent: [hook()] },
    });
    processOnEventHooksPlugin({ setBindings: false })().json!.pre!(c);
    expect(c.state.btnRef_onClick).toBeDefined();
    expect(target.bindings.onClick).toBeUndefined();
  });
});
