import { describe, expect, it } from 'vitest';
import { capitalize } from '../src/internal/capitalize';
import { dashCase } from '../src/internal/dash-case';
import { dedent } from '../src/internal/dedent';
import { fastClone } from '../src/internal/fast-clone';
import { isUpperCase } from '../src/internal/is-upper-case';
import { checkIsDefined } from '../src/internal/nullable';
import {
  GETTER,
  SETTER,
  checkIsGetter,
  extractGetterCodeBlock,
  prefixWithFunction,
  replaceFunctionWithGetter,
  replaceGetterWithFunction,
  stripGetter,
} from '../src/internal/patterns';
import { stripNewlinesInStrings } from '../src/internal/replace-new-lines-in-strings';
import { objectHasKey } from '../src/internal/typescript';

describe('capitalize', () => {
  it('uppercases the first character', () => {
    expect(capitalize('foo')).toBe('Foo');
  });
  it('returns empty string unchanged', () => {
    expect(capitalize('')).toBe('');
  });
  it('handles single-character input', () => {
    expect(capitalize('x')).toBe('X');
  });
});

describe('dashCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(dashCase('helloWorld')).toBe('hello-world');
  });
  it('converts PascalCase to kebab-case', () => {
    expect(dashCase('SomeName')).toBe('some-name');
  });
});

describe('isUpperCase', () => {
  it('returns true for fully uppercase strings', () => {
    expect(isUpperCase('FOO')).toBe(true);
    expect(isUpperCase('A')).toBe(true);
  });
  it('returns false for any lowercase character', () => {
    expect(isUpperCase('Foo')).toBe(false);
    expect(isUpperCase('foo')).toBe(false);
  });
  it('returns true for non-letter strings', () => {
    expect(isUpperCase('123')).toBe(true);
  });
});

describe('checkIsDefined', () => {
  it('returns false for null and undefined', () => {
    expect(checkIsDefined(null)).toBe(false);
    expect(checkIsDefined(undefined)).toBe(false);
  });
  it('returns true for falsy non-null values', () => {
    expect(checkIsDefined(0)).toBe(true);
    expect(checkIsDefined('')).toBe(true);
    expect(checkIsDefined(false)).toBe(true);
  });
});

describe('fastClone', () => {
  it('produces a deep clone via JSON', () => {
    const src = { a: 1, b: { c: [1, 2] } };
    const clone = fastClone(src);
    expect(clone).toEqual(src);
    expect(clone).not.toBe(src);
    expect(clone.b).not.toBe(src.b);
    clone.b.c.push(3);
    expect(src.b.c).toEqual([1, 2]);
  });
});

describe('stripNewlinesInStrings', () => {
  it('replaces newlines inside string literals only', () => {
    expect(stripNewlinesInStrings('"a\nb"')).toBe('"a b"');
    expect(stripNewlinesInStrings('a\nb')).toBe('a\nb');
  });
  it('handles single-quoted strings', () => {
    expect(stripNewlinesInStrings("'a\nb'")).toBe("'a b'");
  });
});

describe('dedent', () => {
  it('strips leading minimum indentation', () => {
    const result = dedent`
      hello
        world
    `;
    expect(result).toBe('hello\n  world');
  });
});

describe('patterns', () => {
  it('detects getters', () => {
    expect(GETTER.test(' get foo()')).toBe(true);
    expect(SETTER.test(' set foo()')).toBe(true);
    expect(checkIsGetter('get x() { return 1; }')).not.toBeNull();
    expect(checkIsGetter('function x() {}')).toBeNull();
  });
  it('strips getter prefix', () => {
    expect(stripGetter('get x() { return 1; }')).toBe('x() { return 1; }');
  });
  it('replaces getter with function', () => {
    expect(replaceGetterWithFunction('get x() {}')).toBe('function x() {}');
  });
  it('replaces function with getter', () => {
    expect(replaceFunctionWithGetter('function x() {}')).toBe('get x() {}');
  });
  it('extracts code block body', () => {
    expect(extractGetterCodeBlock('get x() { return 42; }')).toBe('return 42;');
  });
  it('prefixes with function keyword', () => {
    expect(prefixWithFunction('x() {}')).toBe('function x() {}');
  });
});

describe('objectHasKey', () => {
  it('narrows the key type when present', () => {
    const obj = { foo: 1, bar: 'x' };
    expect(objectHasKey(obj, 'foo')).toBe(true);
    expect(objectHasKey(obj, 'baz')).toBe(false);
  });
});
