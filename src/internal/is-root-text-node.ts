import type { JsonComponent, JsonNode } from '../types';

export function isRootTextNode(json: JsonComponent | JsonNode) {
  const firstChild = json.children[0];
  return Boolean(json.children.length === 1 && firstChild && isTextNode(firstChild));
}

export function isTextNode(node: JsonNode) {
  return Boolean(node.properties._text || node.bindings._text);
}
