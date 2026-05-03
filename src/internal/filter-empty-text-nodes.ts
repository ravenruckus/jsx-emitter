import type { JsonNode } from '../types';

export const isEmptyTextNode = (node: JsonNode) => {
  return typeof node.properties._text === 'string' && node.properties._text.trim().length === 0;
};

export const filterEmptyTextNodes = (node: JsonNode) => !isEmptyTextNode(node);
