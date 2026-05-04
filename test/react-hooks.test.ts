import { describe, expect, it } from 'vitest';
import {
  getOnEventHookComponentBody,
  getOnInitHookComponentBody,
  getOnMountComponentBody,
  getOnUnMountComponentBody,
  getOnUpdateComponentBody,
} from '../src/internal/hooks';
import type { JsonComponent, OnEventHook, ToReactOptions } from '../src/types';

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

describe('getOnInitHookComponentBody', () => {
  it('returns empty string when no onInit hook is defined', () => {
    expect(getOnInitHookComponentBody({ json: component(), options: opts() })).toBe('');
  });

  it('inlines the hook body when shouldInlineOnInitHook is true', () => {
    const c = component({ hooks: { onMount: [], onEvent: [], onInit: { code: 'state.x = 1' } } });
    const out = getOnInitHookComponentBody({ json: c, options: opts(), shouldInlineOnInitHook: true });
    expect(out).toContain('setX(1)');
    expect(out).not.toContain('hasInitialized');
  });

  it('wraps the hook body in a useRef-guarded block when shouldInlineOnInitHook is false/undefined', () => {
    const c = component({ hooks: { onMount: [], onEvent: [], onInit: { code: 'state.x = 1' } } });
    const out = getOnInitHookComponentBody({ json: c, options: opts() });
    expect(out).toContain('const hasInitialized = useRef(false);');
    expect(out).toContain('if (!hasInitialized.current)');
    expect(out).toContain('setX(1)');
    expect(out).toContain('hasInitialized.current = true;');
  });

  it('processes the hook code through state-setter rewriting', () => {
    const c = component({
      hooks: { onMount: [], onEvent: [], onInit: { code: 'state.foo = state.bar + 1' } },
    });
    const out = getOnInitHookComponentBody({ json: c, options: opts({ stateType: 'useState' }) });
    expect(out).toContain('setFoo(bar + 1)');
  });
});

describe('getOnEventHookComponentBody', () => {
  it('returns empty string when no onEvent hooks are defined', () => {
    expect(getOnEventHookComponentBody(component())).toBe('');
  });

  it('emits a useEffect with addEventListener and a cleanup removeEventListener for each hook', () => {
    const onEventHook: OnEventHook = {
      code: 'console.log("hi")',
      refName: 'btnRef',
      eventName: 'click',
      isRoot: false,
      eventArgName: 'event',
    };
    const c = component({ hooks: { onMount: [], onEvent: [onEventHook] } });
    const out = getOnEventHookComponentBody(c);
    expect(out).toContain('useEffect(() => {');
    expect(out).toMatch(/btnRef\.current\?\.addEventListener\("click",/);
    expect(out).toMatch(/return \(\) => btnRef\.current\?\.removeEventListener\("click",/);
    expect(out).toContain('}, []);');
  });

  it('joins multiple hook bodies with newlines', () => {
    const a: OnEventHook = {
      code: '',
      refName: 'a',
      eventName: 'click',
      isRoot: false,
      eventArgName: 'e',
    };
    const b: OnEventHook = {
      code: '',
      refName: 'b',
      eventName: 'mouseover',
      isRoot: false,
      eventArgName: 'e',
    };
    const c = component({ hooks: { onMount: [], onEvent: [a, b] } });
    const out = getOnEventHookComponentBody(c);
    expect(out.match(/useEffect/g)?.length).toBe(2);
  });
});

describe('getOnMountComponentBody', () => {
  it('returns empty string when no onMount hooks are defined', () => {
    expect(getOnMountComponentBody({ json: component(), options: opts() })).toBe('');
  });

  it('emits a useEffect for each onMount hook with empty deps array', () => {
    const c = component({
      hooks: { onMount: [{ code: 'state.x = 1' }, { code: 'doThing()' }], onEvent: [] },
    });
    const out = getOnMountComponentBody({ json: c, options: opts() });
    expect(out.match(/useEffect\(\(\) => \{/g)?.length).toBe(2);
    expect(out).toContain('setX(1)');
    expect(out).toContain('doThing()');
    expect(out).toMatch(/}, \[\]\)/);
  });
});

describe('getOnUpdateComponentBody', () => {
  it('returns empty string when no onUpdate hooks are defined (undefined or missing array)', () => {
    expect(getOnUpdateComponentBody({ json: component(), options: opts() })).toBe('');
  });

  it('emits a useEffect with the hook body and processed deps for each onUpdate', () => {
    const c = component({
      hooks: {
        onMount: [],
        onEvent: [],
        onUpdate: [{ code: 'state.x = 1', deps: '[state.foo, props.bar]' }],
      },
    });
    const out = getOnUpdateComponentBody({ json: c, options: opts() });
    expect(out).toContain('useEffect(() => {');
    expect(out).toContain('setX(1)');
    expect(out).toContain('[foo, props.bar]');
  });

  it('joins multiple onUpdate effects with `;`', () => {
    const c = component({
      hooks: { onMount: [], onEvent: [], onUpdate: [{ code: 'a()' }, { code: 'b()' }] },
    });
    const out = getOnUpdateComponentBody({ json: c, options: opts() });
    expect(out.split(';').length).toBeGreaterThanOrEqual(2);
  });

  it('emits an empty deps argument when hook.deps is missing', () => {
    const c = component({
      hooks: { onMount: [], onEvent: [], onUpdate: [{ code: 'a()' }] },
    });
    const out = getOnUpdateComponentBody({ json: c, options: opts() });
    expect(out).toMatch(/\}\,\s*\)/);
  });
});

describe('getOnUnMountComponentBody', () => {
  it('returns empty string when no onUnMount hook is defined', () => {
    expect(getOnUnMountComponentBody({ json: component(), options: opts() })).toBe('');
  });

  it('emits a useEffect with a cleanup return that runs the hook code', () => {
    const c = component({
      hooks: { onMount: [], onEvent: [], onUnMount: { code: 'state.x = 1' } },
    });
    const out = getOnUnMountComponentBody({ json: c, options: opts() });
    expect(out).toContain('useEffect(() => {');
    expect(out).toContain('return () => {');
    expect(out).toContain('setX(1)');
    expect(out).toMatch(/}, \[\]\)/);
  });
});
