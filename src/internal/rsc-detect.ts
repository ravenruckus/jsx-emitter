import traverse from 'neotraverse/legacy';
import type { JsonComponent, JsonNode } from '../types';
import { checkIsEvent } from './event-handlers';
import { isNode } from './is-node';

const checkIsNodeAUserComponent = (node: JsonNode) =>
  node.name[0] === node.name[0].toUpperCase();

export const checkIfIsClientComponent = (json: JsonComponent) => {
  if (json.hooks.onMount.length) return true;
  if (json.hooks.onUnMount?.code) return true;
  if (json.hooks.onUpdate?.length) return true;
  if (Object.keys(json.refs).length) return true;
  if (Object.keys(json.context.set).length) return true;
  if (Object.keys(json.context.get).length) return true;
  if (Object.values(json.state).filter((s) => s?.type === 'property').length) return true;

  let foundEventListener = false;
  traverse(json).forEach(function (node) {
    if (isNode(node) && !checkIsNodeAUserComponent(node)) {
      if (Object.keys(node.bindings).filter((item) => checkIsEvent(item)).length) {
        foundEventListener = true;
        this.stop();
      }
    }
  });

  return foundEventListener;
};
