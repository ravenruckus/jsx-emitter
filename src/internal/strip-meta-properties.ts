import traverse from 'neotraverse/legacy';
import type { JsonComponent } from '../types';
import { isNode } from './is-node';

export const stripMetaProperties = (json: JsonComponent) => {
  traverse(json).forEach((item) => {
    if (isNode(item)) {
      for (const property in item.properties) {
        if (property.startsWith('$')) {
          delete item.properties[property];
        }
      }
      for (const property in item.bindings) {
        if (property.startsWith('$')) {
          delete item.bindings[property];
        }
      }
    }
  });

  return json;
};
