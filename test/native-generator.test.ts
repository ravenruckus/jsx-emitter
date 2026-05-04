import { describe, expect, it } from 'vitest';
import { componentToReactNative } from '../src/generator';
import { createSingleBinding } from '../src/internal/bindings';
import { createNode } from '../src/internal/create-node';
import type { JsonComponent } from '../src/types';

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

const compile = (
  c: JsonComponent,
  opts: Parameters<typeof componentToReactNative>[0] = {},
) => componentToReactNative({ prettier: false, ...opts })({ component: c });

describe('componentToReactNative — entry shape', () => {
  it('returns a transpiler function', () => {
    expect(typeof componentToReactNative()).toBe('function');
  });

  it('renames lowercase HTML tags to React Native primitives', () => {
    const out = compile(
      component({
        name: 'C',
        children: [
          createNode({ name: 'div' }),
          createNode({ name: 'input' }),
          createNode({ name: 'img' }),
          createNode({ name: 'a' }),
          createNode({ name: 'button' }),
        ],
      }),
    );
    expect(out).toContain('<View ');
    expect(out).toContain('<TextInput ');
    expect(out).toContain('<Image ');
    expect(out).toContain('<TouchableOpacity ');
    expect(out).toContain('<Button ');
  });

  it('renames a div with onClick to Pressable', () => {
    const out = compile(
      component({
        name: 'C',
        children: [
          createNode({
            name: 'div',
            bindings: { onClick: createSingleBinding({ code: 'go()' }) },
          }),
        ],
      }),
    );
    expect(out).toContain('<Pressable');
  });

  it('imports react-native primitives instead of react-dom', () => {
    const out = compile(
      component({
        name: 'C',
        children: [createNode({ name: 'div' })],
      }),
    );
    expect(out).toContain("from 'react-native'");
    expect(out).not.toContain("'use client'");
  });

  it('renames a node containing _text to Text', () => {
    const out = compile(
      component({
        name: 'C',
        children: [
          createNode({
            name: 'span',
            properties: { _text: 'hi' },
          }),
        ],
      }),
    );
    expect(out).toContain('<Text>hi</Text>');
  });
});

describe('componentToReactNative — class/className stripping', () => {
  it('strips class and className when stylesType is react-native (default)', () => {
    const out = compile(
      component({
        name: 'C',
        children: [
          createNode({
            name: 'div',
            properties: { class: 'foo', className: 'bar' },
          }),
        ],
      }),
    );
    expect(out).not.toMatch(/\bclassName\s*=\s*"foo"/);
    expect(out).not.toMatch(/\bclassName\s*=\s*"bar"/);
    expect(out).not.toMatch(/\bclass\s*=\s*"foo"/);
  });
});

describe('componentToReactNative — twrnc', () => {
  it('rewrites class to a tw-template style binding', () => {
    const out = compile(
      component({
        name: 'C',
        children: [createNode({ name: 'div', properties: { class: 'p-4 bg-red-500' } })],
      }),
      { stylesType: 'twrnc' },
    );
    expect(out).toContain('tw`p-4 bg-red-500`');
    expect(out).toContain("import tw from 'twrnc'");
  });

  it('uses tw.style() when class is a binding (dynamic)', () => {
    const out = compile(
      component({
        name: 'C',
        children: [
          createNode({
            name: 'div',
            bindings: { class: createSingleBinding({ code: 'state.cls' }) },
          }),
        ],
      }),
      { stylesType: 'twrnc', stateType: 'useState' },
    );
    expect(out).toMatch(/tw\.style\(/);
  });
});

describe('componentToReactNative — native-wind', () => {
  it('combines static class + className into a single className property', () => {
    const out = compile(
      component({
        name: 'C',
        children: [
          createNode({
            name: 'div',
            properties: { class: 'p-4', className: 'bg-red-500' },
          }),
        ],
      }),
      { stylesType: 'native-wind' },
    );
    expect(out).toMatch(/className\s*=\s*"p-4 bg-red-500"/);
  });
});

describe('componentToReactNative — stateType=variables', () => {
  it('emits no useState import and renders state as plain const declarations', () => {
    const out = compile(
      component({
        name: 'C',
        state: { x: { code: '1', type: 'property' } },
        children: [createNode({ name: 'div' })],
      }),
      { stateType: 'variables' },
    );
    expect(out).not.toContain('useState');
    expect(out).toMatch(/const\s+x\s*=\s*1/);
  });
});
