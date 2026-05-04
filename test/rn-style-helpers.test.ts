import { describe, expect, it } from 'vitest';
import { extractCssVarDefaultValue } from '../src/internal/extract-css-var-default-value';
import { cleanReactNativeBlockStyles } from '../src/internal/rn-helpers';
import { sanitizeReactNativeBlockStyles } from '../src/internal/sanitize-rn-block-styles';
import type { ToReactOptions } from '../src/types';

const opts = (overrides: Partial<ToReactOptions> = {}): ToReactOptions => ({
  stylesType: 'react-native',
  stateType: 'useState',
  type: 'native',
  ...overrides,
});

describe('extractCssVarDefaultValue', () => {
  it('extracts the fallback value from a var() expression', () => {
    expect(extractCssVarDefaultValue('var(--foo, 12px)')).toBe('12px');
  });

  it('trims whitespace around the fallback value', () => {
    expect(extractCssVarDefaultValue('var(--foo,   red   )')).toBe('red');
  });

  it('returns the input unchanged when there is no var() expression', () => {
    expect(extractCssVarDefaultValue('12px')).toBe('12px');
  });

  it('repeatedly resolves multiple var() expressions in the same string', () => {
    expect(extractCssVarDefaultValue('var(--a, 1px) var(--b, 2px)')).toBe('1px 2px');
  });
});

describe('cleanReactNativeBlockStyles', () => {
  it('strips unsupported properties', () => {
    const out = cleanReactNativeBlockStyles({
      width: '12px',
      cursor: 'pointer',
      transition: 'all 1s',
    });
    expect(out.width).toBeDefined();
    expect(out.cursor).toBeUndefined();
    expect(out.transition).toBeUndefined();
  });

  it('parses pixel units to numbers', () => {
    const out = cleanReactNativeBlockStyles({ width: '12px' });
    expect(out.width).toBe(12);
  });

  it('keeps a single-value px shorthand on the bare property (px parses to number first)', () => {
    // Upstream parity: the pixel-parse pass converts '4px' → 4 BEFORE the shorthand
    // expansion sees the value, so expandShorthand falls into its non-string branch
    // and returns `{ margin: 4 }` instead of expanding to per-side keys.
    const out = cleanReactNativeBlockStyles({ margin: '4px' });
    expect(out.margin).toBe(4);
  });

  it('expands a multi-token (whitespace-separated) shorthand into per-side properties', () => {
    const out = cleanReactNativeBlockStyles({ padding: '4 8' });
    expect(out).toMatchObject({
      paddingTop: 4,
      paddingRight: 8,
      paddingBottom: 4,
      paddingLeft: 8,
    });
  });

  it('rewrites `background` to `backgroundColor`', () => {
    const out = cleanReactNativeBlockStyles({ background: 'red' });
    expect(out.backgroundColor).toBe('red');
    expect((out as Record<string, unknown>).background).toBeUndefined();
  });

  it('expands `borderRadius` into per-corner radii (single value)', () => {
    const out = cleanReactNativeBlockStyles({ borderRadius: '4' });
    expect(out).toMatchObject({
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      borderBottomLeftRadius: 4,
    });
  });

  it('drops invalid `display` values that are neither flex nor none', () => {
    const out = cleanReactNativeBlockStyles({ display: 'block' });
    expect((out as Record<string, unknown>).display).toBeUndefined();
  });

  it('keeps a valid `display: flex`', () => {
    const out = cleanReactNativeBlockStyles({ display: 'flex' });
    expect(out.display).toBe('flex');
  });

  it('extracts var() default values before validation', () => {
    const out = cleanReactNativeBlockStyles({ color: 'var(--my-color, red)' });
    expect(out.color).toBe('red');
  });
});

describe('sanitizeReactNativeBlockStyles', () => {
  it('delegates to cleanReactNativeBlockStyles when sanitizeReactNative=true', () => {
    const out = sanitizeReactNativeBlockStyles(
      { width: '12px', cursor: 'pointer' },
      opts({ sanitizeReactNative: true }),
    );
    expect(out.width).toBe(12);
    expect((out as Record<string, unknown>).cursor).toBeUndefined();
  });

  it('strips px units to numbers when sanitizeReactNative is unset (default path)', () => {
    const out = sanitizeReactNativeBlockStyles({ width: '12px' }, opts());
    expect(out.width).toBe(12);
  });

  it('drops a key whose pixel value normalizes to 0 (default path)', () => {
    const out = sanitizeReactNativeBlockStyles({ width: '0.0px' }, opts());
    expect((out as Record<string, unknown>).width).toBeUndefined();
  });

  it('preserves the literal string "0" as the number 0', () => {
    const out = sanitizeReactNativeBlockStyles({ margin: '0' }, opts());
    expect(out.margin).toBe(0);
  });

  it('drops invalid display values with a console warning (default path)', () => {
    const out = sanitizeReactNativeBlockStyles({ display: 'block' }, opts());
    expect((out as Record<string, unknown>).display).toBeUndefined();
  });

  it('keeps display: flex unchanged (default path)', () => {
    const out = sanitizeReactNativeBlockStyles({ display: 'flex' }, opts());
    expect(out.display).toBe('flex');
  });

  it('drops lineHeight when its value is not a number (default path)', () => {
    const out = sanitizeReactNativeBlockStyles({ lineHeight: '1.5em' }, opts());
    expect((out as Record<string, unknown>).lineHeight).toBeUndefined();
  });

  it('passes non-pixel string values through unchanged (default path)', () => {
    const out = sanitizeReactNativeBlockStyles({ color: 'red' }, opts());
    expect(out.color).toBe('red');
  });
});
