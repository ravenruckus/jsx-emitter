import { describe, expect, it } from 'vitest';
import { createNode } from '../src/internal/create-node';
import { processTargetBlocks } from '../src/internal/plugins/process-target-blocks';
import { getMagicString } from '../src/internal/use-target-magic';
import type { JsonComponent, TargetBlockDefinition } from '../src/types';

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

const targetBlock = (overrides: Partial<TargetBlockDefinition>): TargetBlockDefinition => ({
  settings: { requiresDefault: false },
  ...overrides,
});

describe('processTargetBlocks', () => {
  it('returns a Plugin with a json.pre hook', () => {
    const plugin = processTargetBlocks();
    const result = plugin();
    expect(result.json?.pre).toBeTypeOf('function');
  });

  it('replaces the magic placeholder in a binding with the react block code', () => {
    const node = createNode({
      bindings: {
        value: {
          code: `"${getMagicString('1')}"`,
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const json = baseComponent({
      children: [node],
      targetBlocks: {
        '1': targetBlock({
          react: { code: 'reactValue' },
          default: { code: 'defaultValue' },
        }),
      },
    });
    processTargetBlocks()().json!.pre!(json);
    expect(json.children[0].bindings.value?.code).toBe('reactValue');
  });

  it('falls back to the default block when no react block is defined', () => {
    const node = createNode({
      bindings: {
        value: {
          code: `"${getMagicString('1')}"`,
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const json = baseComponent({
      children: [node],
      targetBlocks: {
        '1': targetBlock({
          default: { code: 'defaultValue' },
        }),
      },
    });
    processTargetBlocks()().json!.pre!(json);
    expect(json.children[0].bindings.value?.code).toBe('defaultValue');
  });

  it('replaces multiple magic strings within the same code blob', () => {
    const node = createNode({
      bindings: {
        v: {
          code: `"${getMagicString('1')}" + "${getMagicString('2')}"`,
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const json = baseComponent({
      children: [node],
      targetBlocks: {
        '1': targetBlock({ react: { code: 'A' } }),
        '2': targetBlock({ react: { code: 'B' } }),
      },
    });
    processTargetBlocks()().json!.pre!(json);
    expect(json.children[0].bindings.v?.code).toBe('A + B');
  });

  it('throws when the targetBlocks map has no entry for the captured id', () => {
    const node = createNode({
      bindings: {
        v: {
          code: `"${getMagicString('99')}"`,
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const json = baseComponent({
      name: 'MyComp',
      children: [node],
      targetBlocks: {},
    });
    expect(() => processTargetBlocks()().json!.pre!(json)).toThrow(
      /Could not find `useTarget\(\)` value in "MyComp"/,
    );
  });

  it('throws when no react block + no default + requiresDefault', () => {
    const node = createNode({
      bindings: {
        v: {
          code: `"${getMagicString('1')}"`,
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const json = baseComponent({
      name: 'MyComp',
      children: [node],
      targetBlocks: {
        '1': targetBlock({ settings: { requiresDefault: true } }),
      },
    });
    expect(() => processTargetBlocks()().json!.pre!(json)).toThrow(/no default value was set/);
  });

  it('replaces with empty string when requiresDefault=false and no block matches', () => {
    const node = createNode({
      bindings: {
        v: {
          code: `prefix + "${getMagicString('1')}" + suffix`,
          type: 'single',
          bindingType: 'expression',
        },
      },
    });
    const json = baseComponent({
      children: [node],
      targetBlocks: {
        '1': targetBlock({ settings: { requiresDefault: false } }),
      },
    });
    processTargetBlocks()().json!.pre!(json);
    expect(json.children[0].bindings.v?.code).toBe('prefix +  + suffix');
  });

  it('processes a property containing the magic placeholder by promoting it to a binding', () => {
    const node = createNode({
      properties: {
        title: getMagicString('1'),
      },
    });
    const json = baseComponent({
      children: [node],
      targetBlocks: {
        '1': targetBlock({ react: { code: 'Hello' } }),
      },
    });
    processTargetBlocks()().json!.pre!(json);
    // property promotes to binding: code = `"USE_TARGET_BLOCK_1"`. The same
    // traversal's bindings loop then substitutes the magic value: the regex
    // consumes the surrounding quotes, so the final binding code is the bare
    // block code `Hello` (not `"Hello"`).
    expect(json.children[0].properties.title).toBeUndefined();
    expect(json.children[0].bindings.title?.code).toBe('Hello');
  });

  it('leaves unrelated bindings untouched', () => {
    const node = createNode({
      bindings: {
        keep: { code: 'untouched', type: 'single', bindingType: 'expression' },
      },
    });
    const json = baseComponent({
      children: [node],
      targetBlocks: {},
    });
    processTargetBlocks()().json!.pre!(json);
    expect(json.children[0].bindings.keep?.code).toBe('untouched');
  });
});
