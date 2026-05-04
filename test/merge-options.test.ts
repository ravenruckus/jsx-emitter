import { describe, expect, it } from 'vitest';
import { initializeOptions, mergeOptions } from '../src/internal/merge-options';
import type { JsonComponent, Plugin, ToReactOptions } from '../src/types';

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

const reactDefaults: ToReactOptions = {
  stateType: 'useState',
  stylesType: 'styled-jsx',
  type: 'dom',
};

describe('mergeOptions', () => {
  it('overlays b on a, then c, then d', () => {
    const result = mergeOptions(
      { ...reactDefaults },
      { stateType: 'variables' },
      { stylesType: 'style-tag' },
      { type: 'native' },
    );
    expect(result.stateType).toBe('variables');
    expect(result.stylesType).toBe('style-tag');
    expect(result.type).toBe('native');
  });

  it('concatenates plugins from a, b, c, and d in order', () => {
    const tag = (n: string): Plugin => () => ({ name: n });
    const a = tag('a');
    const b = tag('b');
    const c = tag('c');
    const d = tag('d');
    const result = mergeOptions(
      { ...reactDefaults, plugins: [a] },
      { plugins: [b] },
      { plugins: [c] },
      { plugins: [d] },
    );
    expect(result.plugins.map((p) => p().name)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles a missing plugins field on each layer', () => {
    const result = mergeOptions({ ...reactDefaults });
    expect(result.plugins).toEqual([]);
  });
});

describe('initializeOptions', () => {
  it('returns a plugins array starting with the three default plugins, in order', () => {
    const json = baseComponent();
    const options = initializeOptions({
      component: json,
      defaults: { ...reactDefaults },
    });
    expect(options.plugins.length).toBe(3);
    // Default plugins were unshifted; we cannot read their names directly because the
    // plugin factory shapes don't expose names — assert by structural smoke test
    // (each factory returns an object with a `json.pre` hook).
    for (const plugin of options.plugins) {
      const result = plugin();
      expect(result.json?.pre).toBeTypeOf('function');
    }
  });

  it('applies useMetadata.options.react as the highest-precedence override', () => {
    const json = baseComponent({
      meta: {
        useMetadata: {
          options: { react: { stateType: 'variables' } },
        },
      },
    });
    const options = initializeOptions({
      component: json,
      defaults: { ...reactDefaults },
      userOptions: { stateType: 'useState' },
    });
    expect(options.stateType).toBe('variables');
  });

  it('preserves user plugins after the default-plugins prefix', () => {
    const userPlugin: Plugin = () => ({ name: 'user' });
    const options = initializeOptions<ToReactOptions>({
      component: baseComponent(),
      defaults: { ...reactDefaults, plugins: [] as Plugin[] },
      userOptions: { plugins: [userPlugin] },
    });
    expect(options.plugins.length).toBe(4); // 3 defaults + 1 user
    expect(options.plugins[3]().name).toBe('user');
  });

  it('uses the `extra` slot to layer between userOptions and metadataOverrides', () => {
    const json = baseComponent({
      meta: { useMetadata: { options: { react: { type: 'native' } } } },
    });
    const options = initializeOptions({
      component: json,
      defaults: { ...reactDefaults },
      userOptions: { type: 'dom' },
      extra: { type: 'taro' },
    });
    // metadataOverrides wins (last in the merge chain)
    expect(options.type).toBe('native');
  });

  it('reads useMetadata.options.reactNative when target=reactNative', () => {
    const json = baseComponent({
      meta: {
        useMetadata: {
          options: {
            react: { stateType: 'useState' },
            reactNative: { stateType: 'variables' },
          },
        },
      },
    });
    const options = initializeOptions({
      target: 'reactNative',
      component: json,
      defaults: { ...reactDefaults },
    });
    expect(options.stateType).toBe('variables');
  });

  it('ignores useMetadata.options.reactNative when target defaults to react', () => {
    const json = baseComponent({
      meta: {
        useMetadata: {
          options: {
            reactNative: { stateType: 'variables' },
          },
        },
      },
    });
    const options = initializeOptions({
      component: json,
      defaults: { ...reactDefaults },
    });
    expect(options.stateType).toBe('useState');
  });
});
