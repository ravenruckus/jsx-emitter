import * as CSS from 'csstype';
import json5 from 'json5';
import { pickBy } from 'lodash';
import traverse from 'neotraverse/legacy';
import type { JsonComponent, JsonNode } from '../../types';
import { dashCase } from '../dash-case';
import { isNode } from '../is-node';
import { isUpperCase } from '../is-upper-case';

export const nodeHasCss = (node: JsonNode) => {
  return Boolean(
    typeof node.bindings.css?.code === 'string' && node.bindings.css.code.trim().length > 6,
  );
};

export const nodeHasStyle = (node: JsonNode) => {
  return (
    Boolean(typeof node.bindings.style?.code === 'string') ||
    Boolean(typeof node.properties.style === 'string')
  );
};

export const hasCss = (component: JsonComponent) => {
  let hasStyles = !!component.style?.length;

  if (hasStyles) {
    return true;
  }

  traverse(component).forEach(function (item) {
    if (isNode(item)) {
      if (nodeHasCss(item)) {
        hasStyles = true;
        this.stop();
      }
    }
  });
  return hasStyles;
};

export const hasStyle = (component: JsonComponent) => {
  let hasStyles = false;

  traverse(component).forEach(function (item) {
    if (isNode(item)) {
      if (nodeHasStyle(item)) {
        hasStyles = true;
        this.stop();
      }
    }
  });
  return hasStyles;
};

/**
 * Nested style map. Values are either CSS properties or further nested maps
 * (for selectors like `&:hover` or `@media`).
 */
export type StyleMap = {
  [className: string]: CSS.Properties | StyleMap;
};

export const getNestedSelectors = (map: StyleMap) => {
  return pickBy(map, (value) => typeof value === 'object');
};
export const getStylesOnly = (map: StyleMap) => {
  return pickBy(map, (value) => typeof value === 'string');
};

export type ClassStyleMap = { [key: string]: StyleMap };

export const parseCssObject = (css: string) => {
  try {
    return json5.parse(css);
  } catch (e) {
    console.warn('Could not parse CSS object', css);
    throw e;
  }
};

const getCssPropertyName = (cssObjectKey: string) => {
  if (cssObjectKey.startsWith('--')) {
    return cssObjectKey;
  }
  let str = dashCase(cssObjectKey);

  if (isUpperCase(cssObjectKey[0])) {
    str = `-${str}`;
  }
  return str;
};

export const styleMapToCss = (map: StyleMap): string => {
  return Object.entries(map)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `  ${getCssPropertyName(key)}: ${value};`)
    .join('\n');
};
