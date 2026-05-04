import { describe, expect, it } from 'vitest';
import {
  runPostCodePlugins,
  runPostJsonPlugins,
  runPreCodePlugins,
  runPreJsonPlugins,
} from '../src/internal/plugins-runner';
import type { JsonComponent, Plugin } from '../src/types';

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

describe('runPreJsonPlugins', () => {
  it('returns the input json unchanged when no plugins are present', () => {
    const json = baseComponent({ name: 'A' });
    expect(runPreJsonPlugins({ json, plugins: [] })).toBe(json);
  });

  it('runs each plugin pre.json hook in order, threading the result', () => {
    const order: string[] = [];
    const a: Plugin = () => ({
      json: {
        pre: (j) => {
          order.push('a');
          return { ...j, name: `${j.name}-a` };
        },
      },
    });
    const b: Plugin = () => ({
      json: {
        pre: (j) => {
          order.push('b');
          return { ...j, name: `${j.name}-b` };
        },
      },
    });
    const result = runPreJsonPlugins({ json: baseComponent({ name: 'A' }), plugins: [a, b] });
    expect(order).toEqual(['a', 'b']);
    // Upstream behavior: each plugin receives the ORIGINAL json, not the threaded one.
    // Last plugin's return wins. (Verbatim parity with mitosis/modules/plugins.ts.)
    expect(result.name).toBe('A-b');
  });

  it('falls back to the original json when a plugin returns void', () => {
    const json = baseComponent({ name: 'A' });
    const noopReturn: Plugin = () => ({
      json: {
        pre: () => undefined as unknown as JsonComponent,
      },
    });
    const result = runPreJsonPlugins({ json, plugins: [noopReturn] });
    expect(result).toBe(json);
  });

  it('skips plugins that have no json.pre hook', () => {
    const json = baseComponent({ name: 'A' });
    const codeOnly: Plugin = () => ({
      code: { pre: (s) => s + '!' },
    });
    const result = runPreJsonPlugins({ json, plugins: [codeOnly] });
    expect(result).toBe(json);
  });

  it('passes options to the plugin factory', () => {
    let captured: unknown;
    const p: Plugin = (opts?: any) => {
      captured = opts;
      return { json: { pre: (j) => j } };
    };
    runPreJsonPlugins({ json: baseComponent(), plugins: [p], options: { hello: 'world' } });
    expect(captured).toEqual({ hello: 'world' });
  });
});

describe('runPostJsonPlugins', () => {
  it('runs each plugin post.json hook', () => {
    const json = baseComponent({ name: 'A' });
    const p: Plugin = () => ({
      json: { post: (j) => ({ ...j, name: `${j.name}-post` }) },
    });
    const result = runPostJsonPlugins({ json, plugins: [p] });
    expect(result.name).toBe('A-post');
  });

  it('falls back when post returns void', () => {
    const json = baseComponent({ name: 'A' });
    const p: Plugin = () => ({ json: { post: () => undefined as unknown as JsonComponent } });
    const result = runPostJsonPlugins({ json, plugins: [p] });
    expect(result).toBe(json);
  });
});

describe('runPreCodePlugins', () => {
  it('threads the code through each plugin pre.code hook', () => {
    const json = baseComponent();
    const a: Plugin = () => ({ code: { pre: (s) => s + 'A' } });
    const b: Plugin = () => ({ code: { pre: (s) => s + 'B' } });
    const result = runPreCodePlugins({ code: 'x', json, plugins: [a, b] });
    expect(result).toBe('xAB');
  });

  it('passes the json to the code plugin', () => {
    const json = baseComponent({ name: 'CompName' });
    let seen: string | undefined;
    const p: Plugin = () => ({
      code: {
        pre: (s, j) => {
          seen = j.name;
          return s;
        },
      },
    });
    runPreCodePlugins({ code: 'x', json, plugins: [p] });
    expect(seen).toBe('CompName');
  });

  it('skips plugins without a code.pre hook', () => {
    const json = baseComponent();
    const jsonOnly: Plugin = () => ({ json: { pre: (j) => j } });
    const result = runPreCodePlugins({ code: 'x', json, plugins: [jsonOnly] });
    expect(result).toBe('x');
  });
});

describe('runPostCodePlugins', () => {
  it('threads the code through each plugin post.code hook', () => {
    const json = baseComponent();
    const a: Plugin = () => ({ code: { post: (s) => s + 'A' } });
    const b: Plugin = () => ({ code: { post: (s) => s + 'B' } });
    const result = runPostCodePlugins({ code: 'x', json, plugins: [a, b] });
    expect(result).toBe('xAB');
  });

  it('passes the json to the code plugin', () => {
    const json = baseComponent({ name: 'CompName' });
    let seen: string | undefined;
    const p: Plugin = () => ({
      code: {
        post: (s, j) => {
          seen = j.name;
          return s;
        },
      },
    });
    runPostCodePlugins({ code: 'x', json, plugins: [p] });
    expect(seen).toBe('CompName');
  });
});
