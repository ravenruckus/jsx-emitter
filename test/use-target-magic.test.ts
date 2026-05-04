import { describe, expect, it } from 'vitest';
import {
  getIdFromMatch,
  getMagicString,
  USE_TARGET_MAGIC_REGEX,
  USE_TARGET_MAGIC_STRING,
} from '../src/internal/use-target-magic';

describe('USE_TARGET_MAGIC_STRING', () => {
  it('is the literal "USE_TARGET_BLOCK_"', () => {
    expect(USE_TARGET_MAGIC_STRING).toBe('USE_TARGET_BLOCK_');
  });
});

describe('getMagicString', () => {
  it('appends the targetId to the magic prefix', () => {
    expect(getMagicString('1')).toBe('USE_TARGET_BLOCK_1');
    expect(getMagicString('42')).toBe('USE_TARGET_BLOCK_42');
  });

  it('appends an empty id', () => {
    expect(getMagicString('')).toBe('USE_TARGET_BLOCK_');
  });
});

describe('USE_TARGET_MAGIC_REGEX', () => {
  it('matches a quoted magic string with double quotes', () => {
    const input = `let x = "USE_TARGET_BLOCK_3";`;
    USE_TARGET_MAGIC_REGEX.lastIndex = 0;
    const match = USE_TARGET_MAGIC_REGEX.exec(input);
    expect(match?.[0]).toBe('"USE_TARGET_BLOCK_3"');
    expect(match?.groups?.blockId).toBe('3');
  });

  it("matches a quoted magic string with single quotes", () => {
    const input = `let x = 'USE_TARGET_BLOCK_7';`;
    USE_TARGET_MAGIC_REGEX.lastIndex = 0;
    const match = USE_TARGET_MAGIC_REGEX.exec(input);
    expect(match?.[0]).toBe(`'USE_TARGET_BLOCK_7'`);
    expect(match?.groups?.blockId).toBe('7');
  });

  it('is the global flag so multiple matches are walked', () => {
    expect(USE_TARGET_MAGIC_REGEX.flags).toContain('g');
    const input = `"USE_TARGET_BLOCK_1" + "USE_TARGET_BLOCK_2"`;
    USE_TARGET_MAGIC_REGEX.lastIndex = 0;
    const ids: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = USE_TARGET_MAGIC_REGEX.exec(input)) !== null) {
      ids.push(m.groups?.blockId ?? '');
    }
    expect(ids).toEqual(['1', '2']);
  });

  it('does not match an unquoted magic string', () => {
    const input = `USE_TARGET_BLOCK_5`;
    USE_TARGET_MAGIC_REGEX.lastIndex = 0;
    expect(USE_TARGET_MAGIC_REGEX.exec(input)).toBeNull();
  });

  it('captures empty id (zero-width digit match)', () => {
    const input = `"USE_TARGET_BLOCK_"`;
    USE_TARGET_MAGIC_REGEX.lastIndex = 0;
    const match = USE_TARGET_MAGIC_REGEX.exec(input);
    expect(match?.[0]).toBe(`"USE_TARGET_BLOCK_"`);
    expect(match?.groups?.blockId).toBe('');
  });
});

describe('getIdFromMatch', () => {
  it('extracts the id from a quoted magic string', () => {
    expect(getIdFromMatch(`"USE_TARGET_BLOCK_42"`)).toBe('42');
    expect(getIdFromMatch(`'USE_TARGET_BLOCK_3'`)).toBe('3');
  });

  it('returns undefined when the input does not match', () => {
    expect(getIdFromMatch('no magic here')).toBeUndefined();
  });

  it('returns "" for the empty-id form (zero-width digit match)', () => {
    expect(getIdFromMatch(`"USE_TARGET_BLOCK_"`)).toBe('');
  });

  it('round-trips with getMagicString when wrapped in quotes', () => {
    const id = '99';
    const wrapped = `"${getMagicString(id)}"`;
    expect(getIdFromMatch(wrapped)).toBe(id);
  });
});
