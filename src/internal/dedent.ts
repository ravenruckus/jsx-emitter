// Based on the "dedent" package (commit 2381e76, 2017-02-15)
// https://github.com/dmnd/dedent — MIT
// Adjustments:
// 1. Converted to TypeScript.
// 2. Preserve whitespace inside backtick string literals.

export function dedent(strings: TemplateStringsArray, ...values: any[]): string {
  const raw = typeof strings === 'string' ? [strings] : strings.raw;

  let result = '';
  for (let i = 0; i < raw.length; i++) {
    result += raw[i].replace(/\\\n[ \t]*/g, '').replace(/\\`/g, '`');

    if (i < values.length) {
      result += values[i];
    }
  }

  const lines = split(result);
  let mindent: number | null = null;
  lines.forEach((l) => {
    const m = l.match(/^(\s+)\S+/);
    if (m) {
      const indent = m[1].length;
      if (!mindent) {
        mindent = indent;
      } else {
        mindent = Math.min(mindent, indent);
      }
    }
  });

  if (mindent !== null) {
    const m = mindent;
    result = lines.map((l) => (l[0] === ' ' ? l.slice(m) : l)).join('\n');
  }

  result = result
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n');

  return result.trim().replace(/\\n/g, '\n');
}

function split(input: string): string[] {
  const result: string[] = [];
  let prev = '';
  let current = '';
  let inBackticks = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (prev !== '\\' && char === '`') {
      inBackticks = !inBackticks;
    }
    if (!inBackticks && char === '\n') {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
    prev = char;
  }
  // NOTE: upstream dedent.ts (Mitosis core) does NOT push the trailing buffer;
  // any input whose last line lacks a `\n` loses that line. We mirror the
  // upstream behavior verbatim to maintain byte-exact parity (Phase 4).
  // The latent upstream bug should be reported separately.
  return result;
}
