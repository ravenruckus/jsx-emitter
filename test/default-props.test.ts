import { describe, expect, it } from 'vitest';
import { getDefaultProps } from '../src/internal/default-props';
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

describe('getDefaultProps', () => {
  it('returns empty string when defaultProps is undefined', () => {
    expect(getDefaultProps(component())).toBe('');
  });

  it('returns empty string when defaultProps is an empty object', () => {
    expect(getDefaultProps(component({ defaultProps: {} }))).toBe('');
  });

  it('emits a destructuring-with-defaults expression for one default', () => {
    const c = component({
      defaultProps: { count: { code: '0', type: 'property' } },
    });
    expect(getDefaultProps(c)).toBe('props = {count: 0, ...props}');
  });

  it('joins multiple default props with `,`', () => {
    const c = component({
      defaultProps: {
        count: { code: '0', type: 'property' },
        name: { code: '"abc"', type: 'property' },
      },
    });
    const out = getDefaultProps(c);
    expect(out).toContain('count: 0');
    expect(out).toContain('name: "abc"');
    expect(out.startsWith('props = {')).toBe(true);
    expect(out.endsWith(', ...props}')).toBe(true);
  });
});
