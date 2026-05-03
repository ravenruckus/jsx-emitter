import { describe, expect, it } from 'vitest';
import { createNode } from '../src/internal/create-node';
import { checkIsBindingNativeEvent, checkIsEvent, getEventNameWithoutOn } from '../src/internal/event-handlers';
import { filterEmptyTextNodes, isEmptyTextNode } from '../src/internal/filter-empty-text-nodes';
import isChildren, { getTextValue } from '../src/internal/is-children';
import { isNode } from '../src/internal/is-node';
import { isRootTextNode, isTextNode } from '../src/internal/is-root-text-node';
import { isValidAttributeName } from '../src/internal/is-valid-attribute-name';
import { getForArguments } from '../src/internal/nodes/for';
import { traverseNodes } from '../src/internal/traverse-nodes';
import type { ForNode, JsonComponent, JsonNode } from '../src/types';

const div = (overrides: Partial<JsonNode> = {}): JsonNode => ({
  '@type': 'jsx-emitter/node',
  meta: {},
  name: 'div',
  scope: {},
  properties: {},
  bindings: {},
  children: [],
  ...overrides,
});

describe('createNode', () => {
  it('emits the jsx-emitter discriminator', () => {
    expect(createNode({})['@type']).toBe('jsx-emitter/node');
  });
  it('defaults name to div', () => {
    expect(createNode({}).name).toBe('div');
  });
  it('overrides via options', () => {
    expect(createNode({ name: 'span', properties: { id: 'x' } }).name).toBe('span');
  });
});

describe('isNode (accepts legacy + new discriminator)', () => {
  it('returns true for new jsx-emitter/node tag', () => {
    expect(isNode({ '@type': 'jsx-emitter/node' })).toBe(true);
  });
  it('returns true for legacy upstream-toolchain tag', () => {
    expect(isNode({ '@type': '@builder.io/mitosis/node' })).toBe(true);
  });
  it('returns false for any other tag', () => {
    expect(isNode({ '@type': 'something/else' })).toBe(false);
    expect(isNode({})).toBe(false);
    expect(isNode(null)).toBe(false);
    expect(isNode(undefined)).toBe(false);
    expect(isNode('string')).toBe(false);
  });
});

describe('isEmptyTextNode / filterEmptyTextNodes', () => {
  it('detects whitespace-only _text', () => {
    expect(isEmptyTextNode(div({ properties: { _text: '   ' } }))).toBe(true);
    expect(isEmptyTextNode(div({ properties: { _text: 'x' } }))).toBe(false);
    expect(isEmptyTextNode(div())).toBe(false);
  });
  it('filterEmptyTextNodes is the negation', () => {
    expect(filterEmptyTextNodes(div({ properties: { _text: '   ' } }))).toBe(false);
    expect(filterEmptyTextNodes(div({ properties: { _text: 'x' } }))).toBe(true);
  });
});

describe('isChildren / getTextValue', () => {
  it('detects props.children, children, children()', () => {
    expect(isChildren({ node: div({ bindings: { _text: { code: 'props.children', type: 'single', bindingType: 'expression' } } }) })).toBe(true);
    expect(isChildren({ node: div({ bindings: { _text: { code: 'children', type: 'single', bindingType: 'expression' } } }) })).toBe(true);
    expect(isChildren({ node: div({ bindings: { _text: { code: 'children()', type: 'single', bindingType: 'expression' } } }) })).toBe(true);
    expect(isChildren({ node: div({ bindings: { _text: { code: 'props.x', type: 'single', bindingType: 'expression' } } }) })).toBe(false);
  });
  it('honors extraMatches', () => {
    expect(isChildren({ node: div({ bindings: { _text: { code: 'foo', type: 'single', bindingType: 'expression' } } }), extraMatches: ['foo'] })).toBe(true);
  });
  it('getTextValue strips whitespace', () => {
    expect(getTextValue(div({ properties: { __text: 'a b\n c' } }))).toBe('abc');
  });
});

describe('isRootTextNode / isTextNode', () => {
  it('isTextNode checks for _text property or binding', () => {
    expect(isTextNode(div({ properties: { _text: 'x' } }))).toBe(true);
    expect(isTextNode(div({ bindings: { _text: { code: 'x', type: 'single', bindingType: 'expression' } } }))).toBe(true);
    expect(isTextNode(div())).toBe(false);
  });
  it('isRootTextNode requires exactly one text child', () => {
    const node = div({ children: [div({ properties: { _text: 'x' } })] });
    expect(isRootTextNode(node)).toBe(true);
    expect(isRootTextNode(div())).toBe(false);
    expect(isRootTextNode(div({ children: [div({ properties: { _text: 'x' } }), div({ properties: { _text: 'y' } })] }))).toBe(false);
  });
});

describe('isValidAttributeName', () => {
  it('allows alphanumerics, dash, underscore, colon', () => {
    expect(isValidAttributeName('data-foo')).toBe(true);
    expect(isValidAttributeName('aria_label')).toBe(true);
    expect(isValidAttributeName('xlink:href')).toBe(true);
    expect(isValidAttributeName('class')).toBe(true);
  });
  it('rejects empty / special chars', () => {
    expect(isValidAttributeName('')).toBe(false);
    expect(isValidAttributeName('foo bar')).toBe(false);
    expect(isValidAttributeName('foo.bar')).toBe(false);
  });
});

describe('event-handlers', () => {
  it('checkIsEvent recognizes onCamelCase prefix', () => {
    expect(checkIsEvent('onClick')).toBe(true);
    expect(checkIsEvent('onSubmit')).toBe(true);
    expect(checkIsEvent('onclick')).toBe(false);
    expect(checkIsEvent('click')).toBe(false);
  });
  it('getEventNameWithoutOn removes prefix and camelCases', () => {
    expect(getEventNameWithoutOn('onClick')).toBe('click');
    expect(getEventNameWithoutOn('onMouseDown')).toBe('mouseDown');
  });
  it('checkIsBindingNativeEvent matches native DOM events', () => {
    expect(checkIsBindingNativeEvent('click')).toBe(true);
    expect(checkIsBindingNativeEvent('Click')).toBe(true);
    expect(checkIsBindingNativeEvent('myCustomEvent')).toBe(false);
  });
});

describe('getForArguments', () => {
  const forNode: ForNode = {
    '@type': 'jsx-emitter/node',
    meta: {},
    name: 'For',
    scope: { forName: 'item', indexName: 'i', collectionName: 'items' },
    properties: {},
    bindings: {},
    children: [],
  };
  it('returns [forName, indexName, collectionName]', () => {
    expect(getForArguments(forNode)).toEqual(['item', 'i', 'items']);
  });
  it('excludes collection when asked', () => {
    expect(getForArguments(forNode, { excludeCollectionName: true })).toEqual(['item', 'i']);
  });
  it('falls back to "item" when forName is missing', () => {
    const n: ForNode = { ...forNode, scope: { forName: undefined, indexName: undefined, collectionName: 'items' } };
    expect(getForArguments(n)).toEqual(['item', 'items']);
  });
});

describe('traverseNodes', () => {
  it('visits every node in component children, including subComponents', () => {
    const inner = div({ name: 'span' });
    const outer = div({ children: [inner] });
    const component: JsonComponent = {
      '@type': 'jsx-emitter/component',
      name: 'C',
      imports: [],
      meta: {},
      inputs: [],
      state: {},
      context: { get: {}, set: {} },
      refs: {},
      hooks: { onMount: [], onEvent: [] },
      children: [outer],
      subComponents: [],
    };
    const seen: string[] = [];
    traverseNodes(component, (n) => seen.push(n.name));
    expect(seen).toEqual(['div', 'span']);
  });
});
