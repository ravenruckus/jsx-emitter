import traverse from 'neotraverse/legacy';
import type { JsonComponent } from '../types';
import { isNode } from './is-node';

export const getRefs = (json: JsonComponent, refKey: string = 'ref') => {
  const refs = new Set<string>();
  traverse(json).forEach(function (item) {
    if (isNode(item)) {
      const binding = item.bindings[refKey];
      if (binding && typeof binding.code === 'string') {
        refs.add(binding.code);
      }
    }
  });

  return refs;
};
