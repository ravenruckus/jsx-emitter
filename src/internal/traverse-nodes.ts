import traverse, { type TraverseContext } from 'neotraverse/legacy';
import type { JsonComponent, JsonNode } from '../types';
import { isNode } from './is-node';

export function traverseNodes(
  component: JsonComponent | JsonNode,
  cb: (node: JsonNode, context: TraverseContext) => void,
) {
  traverse(component).forEach(function (item) {
    if (isNode(item)) {
      cb(item, this);
    }
  });
}
