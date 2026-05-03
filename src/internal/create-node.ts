import type { JsonNode } from '../types';

export const createNode = (options: Partial<JsonNode>): JsonNode => ({
  '@type': 'jsx-emitter/node',
  name: 'div',
  meta: {},
  scope: {},
  properties: {},
  bindings: {},
  children: [],
  ...options,
});
