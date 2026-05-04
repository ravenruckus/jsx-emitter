import { describe, expect, expectTypeOf, it } from 'vitest';
import * as publicApi from '../src';
import type {
  JsonComponent,
  JsonImport,
  JsonNode,
  ToReactNativeOptions,
  ToReactOptions,
} from '../src';

describe('public API barrel', () => {
  it('exports componentToReact and componentToReactNative as functions', () => {
    expect(typeof publicApi.componentToReact).toBe('function');
    expect(typeof publicApi.componentToReactNative).toBe('function');
  });

  it('exports exactly the documented value identifiers', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      ['componentToReact', 'componentToReactNative'].sort(),
    );
  });

  it('exports the documented type identifiers (compile-time check)', () => {
    expectTypeOf<JsonComponent>().toBeObject();
    expectTypeOf<JsonImport>().toBeObject();
    expectTypeOf<JsonNode>().not.toBeAny();
    expectTypeOf<ToReactOptions>().toBeObject();
    expectTypeOf<ToReactNativeOptions>().toBeObject();
  });
});
