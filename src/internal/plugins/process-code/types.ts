import type { TraverseContext } from 'neotraverse/legacy';
import type { JsonComponent, JsonNode } from '../../../types';

export type CodeType =
  | 'hooks'
  | 'hooks-deps'
  | 'hooks-deps-array'
  | 'bindings'
  | 'properties'
  | 'state'
  | 'types'
  | 'context-set'
  // For dynamic JSX elements like `<state.foo>Hello</state.foo>` in source.
  | 'dynamic-jsx-elements';

declare function codeProcessor(
  codeType: CodeType,
  json: JsonComponent,
  node?: JsonNode,
): (code: string, hookType: string, context?: TraverseContext) => string | (() => void);

export type CodeProcessor = typeof codeProcessor;
