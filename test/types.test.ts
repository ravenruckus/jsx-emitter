import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  Binding,
  ComponentMetadata,
  ForNode,
  JsonComponent,
  JsonImport,
  JsonNode,
  ShowNode,
  ToReactOptions,
} from '../src/types';
import { ForNodeName, ShowNodeName, checkIsForNode, checkIsShowNode } from '../src/types';

const baseNode = (overrides: Partial<JsonNode> = {}): JsonNode => ({
  '@type': 'jsx-emitter/node',
  meta: {},
  name: 'div',
  scope: {},
  properties: {},
  bindings: {},
  children: [],
  ...overrides,
});

describe('ToReactOptions surface', () => {
  it('stylesType is exactly the kept five literals', () => {
    expectTypeOf<NonNullable<ToReactOptions['stylesType']>>().toEqualTypeOf<
      'styled-jsx' | 'react-native' | 'style-tag' | 'twrnc' | 'native-wind'
    >();
  });

  it('stateType is exactly useState | variables', () => {
    expectTypeOf<NonNullable<ToReactOptions['stateType']>>().toEqualTypeOf<
      'useState' | 'variables'
    >();
  });

  it('does not declare a preact field', () => {
    expectTypeOf<ToReactOptions>().not.toHaveProperty('preact');
  });

  it('keeps type: dom | native | taro', () => {
    expectTypeOf<NonNullable<ToReactOptions['type']>>().toEqualTypeOf<'dom' | 'native' | 'taro'>();
  });

  it('keeps contextType, forwardRef, rsc, sanitizeReactNative, addUseClientDirectiveIfNeeded', () => {
    expectTypeOf<ToReactOptions>().toHaveProperty('contextType');
    expectTypeOf<ToReactOptions>().toHaveProperty('forwardRef');
    expectTypeOf<ToReactOptions>().toHaveProperty('rsc');
    expectTypeOf<ToReactOptions>().toHaveProperty('sanitizeReactNative');
    expectTypeOf<ToReactOptions>().toHaveProperty('addUseClientDirectiveIfNeeded');
  });
});

describe('JsonNode shape', () => {
  it('emits "jsx-emitter/node" as its @type discriminator', () => {
    const node = baseNode();
    expect(node['@type']).toBe('jsx-emitter/node');
  });

  it('checkIsForNode narrows to ForNode', () => {
    const node: JsonNode = baseNode({
      name: ForNodeName,
      scope: { forName: 'item', indexName: undefined, collectionName: 'items' },
    } as ForNode);
    expect(checkIsForNode(node)).toBe(true);
    if (checkIsForNode(node)) {
      expectTypeOf(node).toEqualTypeOf<ForNode>();
    }
  });

  it('checkIsShowNode narrows to ShowNode', () => {
    const node: JsonNode = baseNode({ name: ShowNodeName } as ShowNode);
    expect(checkIsShowNode(node)).toBe(true);
  });

  it('plain divs are not For or Show nodes', () => {
    const node = baseNode();
    expect(checkIsForNode(node)).toBe(false);
    expect(checkIsShowNode(node)).toBe(false);
  });
});

describe('JsonComponent shape', () => {
  it('uses "jsx-emitter/component" as its @type discriminator', () => {
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
      children: [],
      subComponents: [],
    };
    expect(component['@type']).toBe('jsx-emitter/component');
  });

  it('JsonImport allows optional importKind', () => {
    const im: JsonImport = { path: 'react', imports: { useState: 'useState' } };
    expect(im.path).toBe('react');
  });

  it('Binding is a discriminated union over type/bindingType', () => {
    const single: Binding = { code: 'props.x', type: 'single', bindingType: 'expression' };
    const spread: Binding = { code: 'props', type: 'spread', spreadType: 'normal' };
    expect(single.code).toBe('props.x');
    expect(spread.type).toBe('spread');
  });
});

describe('ComponentMetadata is slimmed', () => {
  it('has react / reactNative / rsc keys but not the dropped frameworks', () => {
    expectTypeOf<ComponentMetadata>().toHaveProperty('react');
    expectTypeOf<ComponentMetadata>().toHaveProperty('reactNative');
    expectTypeOf<ComponentMetadata>().toHaveProperty('rsc');
    expectTypeOf<ComponentMetadata>().not.toHaveProperty('alpine');
    expectTypeOf<ComponentMetadata>().not.toHaveProperty('angular');
    expectTypeOf<ComponentMetadata>().not.toHaveProperty('vue');
    expectTypeOf<ComponentMetadata>().not.toHaveProperty('svelte');
    expectTypeOf<ComponentMetadata>().not.toHaveProperty('solid');
    expectTypeOf<ComponentMetadata>().not.toHaveProperty('builder');
    expectTypeOf<ComponentMetadata>().not.toHaveProperty('qwik');
  });
});
