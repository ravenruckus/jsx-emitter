import { describe, expect, it } from 'vitest';
import { collectCss, normalizeName } from '../src/internal/styles/collect-css';
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

describe('normalizeName', () => {
  it('returns empty string for undefined', () => {
    expect(normalizeName(undefined)).toBe('');
  });
  it('returns empty string for whitespace-only input', () => {
    expect(normalizeName('   ')).toBe('');
  });
  it('returns empty string for input containing no alphanumerics', () => {
    expect(normalizeName('!@#$%')).toBe('');
  });
  it('emits css{numbers} for pure-numeric input', () => {
    expect(normalizeName('123')).toBe('css123');
  });
  it('emits css{numbers} for numeric-with-dashes input', () => {
    expect(normalizeName('1-2-3')).toBe('css123');
  });
  it('strips leading numbers and dashes when followed by alpha', () => {
    expect(normalizeName('123-abc')).toBe('abc');
  });
  it('strips non-alphanumeric characters except dash and underscore', () => {
    expect(normalizeName('hello!@world')).toBe('helloworld');
  });
  it('preserves alphanumerics, dashes and underscores', () => {
    expect(normalizeName('foo-bar_baz1')).toBe('foo-bar_baz1');
  });
});

describe('collectCss', () => {
  it('returns empty string when component has no styles or css bindings', () => {
    expect(collectCss(component())).toBe('');
  });

  it('appends component.style verbatim with a trailing newline', () => {
    const c = component({ style: '.preset { color: red; }' });
    expect(collectCss(c)).toBe('.preset { color: red; }\n');
  });

  it('extracts a class for a single node and appends rules', () => {
    const child = node({
      name: 'span',
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    const c = component({ children: [child] });
    const out = collectCss(c);
    expect(out).toContain('.span {');
    expect(out).toContain('color: red');
  });

  it('attaches the generated class name to properties.class', () => {
    const child = node({
      name: 'span',
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    collectCss(component({ children: [child] }));
    expect(child.properties.class).toBe('span');
  });

  it('combines with an existing class binding using string concatenation', () => {
    const child = node({
      name: 'span',
      bindings: {
        class: { code: 'props.cls', type: 'single', bindingType: 'expression' },
        css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' },
      },
    });
    collectCss(component({ children: [child] }));
    expect(child.bindings.class!.code).toBe("props.cls + ' span'");
  });

  it('removes bindings.css after collection', () => {
    const child = node({
      name: 'span',
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    collectCss(component({ children: [child] }));
    expect(child.bindings.css).toBeUndefined();
  });

  it('reuses class name when two nodes have identical CSS (hash dedupe)', () => {
    const a = node({
      name: 'span',
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    const b = node({
      name: 'span',
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    collectCss(component({ children: [a, b] }));
    expect(a.properties.class).toBe('span');
    expect(b.properties.class).toBe('span');
  });

  it('appends -2 to second class when two nodes have different CSS but same component name', () => {
    const a = node({
      name: 'span',
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    const b = node({
      name: 'span',
      bindings: { css: { code: "{ color: 'blue' }", type: 'single', bindingType: 'expression' } },
    });
    collectCss(component({ children: [a, b] }));
    expect(a.properties.class).toBe('span');
    expect(b.properties.class).toBe('span-2');
  });

  it('appends an option-supplied prefix after the class base name', () => {
    const child = node({
      name: 'span',
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    const out = collectCss(component({ children: [child] }), { prefix: 'abc' });
    expect(child.properties.class).toBe('span-abc');
    expect(out).toContain('.span-abc {');
  });

  it('uses properties.$name when present (dash-cased)', () => {
    const child = node({
      name: 'span',
      properties: { $name: 'MyButton' },
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    collectCss(component({ children: [child] }));
    expect(child.properties.class).toBe('my-button');
  });

  it('preserves h1-h6 element names without dash-casing', () => {
    const child = node({
      name: 'h1',
      bindings: { css: { code: "{ color: 'red' }", type: 'single', bindingType: 'expression' } },
    });
    collectCss(component({ children: [child] }));
    expect(child.properties.class).toBe('h1');
  });

  it('expands &-references in nested selectors to the parent class', () => {
    const child = node({
      name: 'span',
      bindings: {
        css: {
          code: "{ color: 'red', '&.active': { color: 'blue' } }",
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const out = collectCss(component({ children: [child] }));
    expect(out).toContain('.span.active {');
    expect(out).toContain('color: blue');
  });

  it('renders pseudo-class nested selectors as .class:state', () => {
    const child = node({
      name: 'span',
      bindings: {
        css: {
          code: "{ color: 'red', ':hover': { color: 'blue' } }",
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const out = collectCss(component({ children: [child] }));
    expect(out).toContain('.span:hover {');
  });

  it('wraps @-rules so the parent class lives inside the at-rule', () => {
    const child = node({
      name: 'span',
      bindings: {
        css: {
          code: "{ color: 'red', '@media (max-width: 500px)': { color: 'blue' } }",
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const out = collectCss(component({ children: [child] }));
    expect(out).toContain('@media (max-width: 500px) { .span {');
  });

  it('renders descendant selectors with a space when nested key has no & or :', () => {
    const child = node({
      name: 'span',
      bindings: {
        css: {
          code: "{ color: 'red', 'span a': { color: 'blue' } }",
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const out = collectCss(component({ children: [child] }));
    expect(out).toContain('.span span a {');
  });
});
