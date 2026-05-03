export function stripNewlinesInStrings(string: string) {
  let inString: string | null = null;
  return string
    .split('')
    .map((char, index) => {
      if (inString) {
        if (char === '\n') {
          return ' ';
        }
      }

      const isEscaped = string[index - 1] === '\\' && string[index - 2] !== '\\';

      if (!inString && (char === '"' || char === "'") && !isEscaped) {
        inString = char;
      } else if (inString && char === inString && !isEscaped) {
        inString = null;
      }

      return char;
    })
    .join('');
}
