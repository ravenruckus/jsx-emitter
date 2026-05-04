import { describe, expect, it, vi } from 'vitest';
import { createSingleBinding } from '../src/internal/bindings';
import { collectReactNativeStyles } from '../src/internal/collect-rn-styles';
import { createNode } from '../src/internal/create-node';
import type { JsonComponent, JsonNode, ToReactOptions } from '../src/types';

const opts = (overrides: Partial<ToReactOptions> = {}): ToReactOptions => ({
  stylesType: 'react-native',
  stateType: 'useState',
  type: 'native',
  ...overrides,
});

const node = (overrides: Partial<JsonNode> = {}): JsonNode => createNode(overrides);

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

describe('collectReactNativeStyles', () => {
  it('returns an empty map and leaves bindings alone when no node has a css binding', () => {
    const c = component({ children: [node({ name: 'View' })] });
    expect(collectReactNativeStyles(c, opts())).toEqual({});
    expect(c.children[0].bindings.css).toBeUndefined();
    expect(c.children[0].bindings.style).toBeUndefined();
  });

  it('moves a node`s css binding into a styleMap entry keyed by camelCased name + index', () => {
    const target = node({
      name: 'View',
      bindings: { css: createSingleBinding({ code: '{ color: "red" }' }) },
    });
    const c = component({ children: [target] });
    const styleMap = collectReactNativeStyles(c, opts());
    expect(styleMap.view1).toEqual({ color: 'red' });
    expect(target.bindings.css).toBeUndefined();
    expect(target.bindings.style?.code).toBe('styles.view1');
  });

  it('increments the index when two nodes share the same camelCased name', () => {
    const a = node({
      name: 'View',
      bindings: { css: createSingleBinding({ code: '{ color: "red" }' }) },
    });
    const b = node({
      name: 'View',
      bindings: { css: createSingleBinding({ code: '{ color: "blue" }' }) },
    });
    const c = component({ children: [a, b] });
    const styleMap = collectReactNativeStyles(c, opts());
    expect(Object.keys(styleMap).sort()).toEqual(['view1', 'view2']);
    expect(a.bindings.style?.code).toBe('styles.view1');
    expect(b.bindings.style?.code).toBe('styles.view2');
  });

  it('drops media queries from a css binding (with a console warning) and removes empty styleMap entries', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const target = node({
        name: 'View',
        bindings: {
          css: createSingleBinding({
            code: '{ "@media (min-width: 600px)": { color: "red" } }',
          }),
        },
      });
      const c = component({ children: [target] });
      const styleMap = collectReactNativeStyles(c, opts());
      expect(styleMap).toEqual({});
      expect(target.bindings.style).toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('merges into an existing JSON-object style binding using a spread', () => {
    const target = node({
      name: 'View',
      bindings: {
        css: createSingleBinding({ code: '{ color: "red" }' }),
        style: createSingleBinding({ code: '{ flex: 1 }' }),
      },
    });
    const c = component({ children: [target] });
    collectReactNativeStyles(c, opts());
    expect(target.bindings.style?.code).toContain('...styles.view1');
    expect(target.bindings.style?.code).toMatch(/flex\s*:\s*1/);
  });

  it('spreads a non-JSON style binding (e.g. an identifier) inside an object literal', () => {
    const target = node({
      name: 'View',
      bindings: {
        css: createSingleBinding({ code: '{ color: "red" }' }),
        style: createSingleBinding({ code: 'props.style' }),
      },
    });
    const c = component({ children: [target] });
    collectReactNativeStyles(c, opts());
    const code = target.bindings.style?.code ?? '';
    expect(code).toMatch(/\.\.\.styles\.view1/);
    expect(code).toMatch(/\.\.\.props\.style/);
  });

  it('rewrites pixel values in an existing style binding to numbers via sanitize', () => {
    const target = node({
      name: 'View',
      bindings: {
        style: createSingleBinding({ code: '{ width: "12px" }' }),
      },
    });
    const c = component({ children: [target] });
    collectReactNativeStyles(c, opts());
    expect(target.bindings.style?.code).toMatch(/width:\s*12/);
    expect(target.bindings.style?.code).not.toMatch(/12px/);
  });

  it('uses "view" as the camelCase prefix when item.name is empty', () => {
    const target = node({
      name: '',
      bindings: { css: createSingleBinding({ code: '{ color: "red" }' }) },
    });
    const c = component({ children: [target] });
    const styleMap = collectReactNativeStyles(c, opts());
    expect(styleMap.view1).toBeDefined();
  });
});
