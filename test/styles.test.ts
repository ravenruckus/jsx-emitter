import { describe, expect, it } from 'vitest';
import {
  getNestedSelectors,
  getStylesOnly,
  hasCss,
  hasStyle,
  nodeHasCss,
  nodeHasStyle,
  parseCssObject,
  styleMapToCss,
} from '../src/internal/styles/helpers';
import type { JsonComponent, JsonNode } from '../src/types';

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

describe('nodeHasCss', () => {
  it('returns true when bindings.css.code is longer than 6 characters trimmed', () => {
    expect(nodeHasCss(node({ bindings: { css: { code: '{a:b,c:d}', type: 'single', bindingType: 'expression' } } }))).toBe(true);
  });
  it('returns false when bindings.css is missing', () => {
    expect(nodeHasCss(node())).toBe(false);
  });
  it('returns false when bindings.css.code is short (<= 6 chars)', () => {
    expect(nodeHasCss(node({ bindings: { css: { code: '{}', type: 'single', bindingType: 'expression' } } }))).toBe(false);
  });
  it('uses trimmed length so whitespace-padded short values are false', () => {
    expect(nodeHasCss(node({ bindings: { css: { code: '   {}   ', type: 'single', bindingType: 'expression' } } }))).toBe(false);
  });
});

describe('nodeHasStyle', () => {
  it('returns true when bindings.style.code is a string', () => {
    expect(nodeHasStyle(node({ bindings: { style: { code: '{}', type: 'single', bindingType: 'expression' } } }))).toBe(true);
  });
  it('returns true when properties.style is a string', () => {
    expect(nodeHasStyle(node({ properties: { style: 'color: red' } }))).toBe(true);
  });
  it('returns false when neither bindings.style nor properties.style is set', () => {
    expect(nodeHasStyle(node())).toBe(false);
  });
});

describe('hasCss', () => {
  it('returns true when component.style is non-empty', () => {
    expect(hasCss(component({ style: '.x { color: red }' }))).toBe(true);
  });
  it('returns true when a descendant node has css bindings', () => {
    const c = component({
      children: [
        node({
          children: [node({ bindings: { css: { code: '{a:b,c:d}', type: 'single', bindingType: 'expression' } } })],
        }),
      ],
    });
    expect(hasCss(c)).toBe(true);
  });
  it('returns false when no css is present anywhere', () => {
    expect(hasCss(component({ children: [node()] }))).toBe(false);
  });
});

describe('hasStyle', () => {
  it('returns true when a descendant has bindings.style', () => {
    const c = component({
      children: [node({ bindings: { style: { code: '{}', type: 'single', bindingType: 'expression' } } })],
    });
    expect(hasStyle(c)).toBe(true);
  });
  it('returns true when a descendant has properties.style', () => {
    const c = component({
      children: [node({ properties: { style: 'color: red' } })],
    });
    expect(hasStyle(c)).toBe(true);
  });
  it('returns false when no style is present anywhere', () => {
    expect(hasStyle(component({ children: [node()] }))).toBe(false);
  });
});

describe('getNestedSelectors / getStylesOnly', () => {
  it('getNestedSelectors picks only object-valued entries', () => {
    expect(
      getNestedSelectors({ display: 'block', '&:hover': { color: 'red' }, '@media x': { a: 'b' } } as any),
    ).toEqual({ '&:hover': { color: 'red' }, '@media x': { a: 'b' } });
  });
  it('getStylesOnly picks only string-valued entries', () => {
    expect(
      getStylesOnly({ display: 'block', '&:hover': { color: 'red' }, color: 'blue' } as any),
    ).toEqual({ display: 'block', color: 'blue' });
  });
});

describe('parseCssObject', () => {
  it('parses a JSON5 css object string', () => {
    expect(parseCssObject("{display: 'block', color: 'red'}")).toEqual({
      display: 'block',
      color: 'red',
    });
  });
  it('throws when input is not parseable as JSON5', () => {
    expect(() => parseCssObject('not valid {{{')).toThrow();
  });
});

describe('styleMapToCss', () => {
  it('renders one line per string-valued entry, indented two spaces', () => {
    expect(styleMapToCss({ display: 'block', color: 'red' } as any)).toBe(
      '  display: block;\n  color: red;',
    );
  });
  it('skips nested-object entries', () => {
    expect(styleMapToCss({ display: 'block', '&:hover': { color: 'red' } } as any)).toBe(
      '  display: block;',
    );
  });
  it('dash-cases camelCase property names', () => {
    expect(styleMapToCss({ fontSize: '14px' } as any)).toBe('  font-size: 14px;');
  });
  it('prefixes a leading dash for vendor-prefixed PascalCase keys', () => {
    expect(styleMapToCss({ WebkitFoo: 'bar' } as any)).toBe('  -webkit-foo: bar;');
  });
  it('preserves CSS custom properties (--var) verbatim', () => {
    expect(styleMapToCss({ '--my-var': 'red' } as any)).toBe('  --my-var: red;');
  });
});
