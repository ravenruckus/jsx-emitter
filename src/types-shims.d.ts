declare module '@babel/plugin-syntax-decorators';
declare module '@babel/plugin-syntax-typescript';
declare module '@babel/preset-typescript';
declare module 'prettier/standalone' {
  export function format(source: string, options: { parser: string; plugins: unknown[] }): string;
}
declare module 'prettier/parser-typescript';
declare module 'prettier/parser-postcss';
