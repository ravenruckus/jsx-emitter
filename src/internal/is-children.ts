import type { JsonNode } from '../types';

export const getTextValue = (node: JsonNode) => {
  const textValue = node.bindings._text?.code || node.properties.__text || '';
  return textValue.replace(/\s+/g, '');
};

export default function isChildren({
  node,
  extraMatches = [],
}: {
  node: JsonNode;
  extraMatches?: string[];
}): boolean {
  const textValue = getTextValue(node);
  return ['props.children', 'children', 'children()'].concat(extraMatches).includes(textValue);
}
