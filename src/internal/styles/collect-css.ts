import traverse from 'neotraverse/legacy';
import hash from 'object-hash';
import type { JsonComponent, JsonNode } from '../../types';
import { dashCase } from '../dash-case';
import { isNode } from '../is-node';
import {
  ClassStyleMap,
  getNestedSelectors,
  getStylesOnly,
  nodeHasCss,
  parseCssObject,
  styleMapToCss,
} from './helpers';

type CollectStyleOptions = {
  prefix?: string;
};

const trimClassStr = (classStr: string) => classStr.trim().replace(/\s{2,}/g, ' ');

const updateClassForNode = (item: JsonNode, className: string) => {
  if (item.bindings.class) {
    item.bindings.class.code = trimClassStr(`${item.bindings.class.code} + ' ${className}'`);
  } else {
    item.properties.class = trimClassStr(`${item.properties.class || ''} ${className}`);
  }
};

export function normalizeName(name: string | undefined): string {
  if (!name || name.trim() === '' || name.match(/^[^a-zA-Z0-9]*$/)) {
    return '';
  }

  const cleaned = name.replace(/[^a-zA-Z0-9\-_]/g, '');

  if (cleaned.match(/^[0-9-]+$/)) {
    const numbers = cleaned.replace(/[^0-9]/g, '');
    return `css${numbers}`;
  }

  const normalized = cleaned.replace(/^[0-9-]+(?=[a-zA-Z])/, '');

  return normalized || '';
}

const collectStyles = (
  json: JsonComponent,
  options: CollectStyleOptions = {},
): ClassStyleMap => {
  const styleMap: ClassStyleMap = {};

  const componentIndexes: { [className: string]: number | undefined } = {};
  const componentHashes: { [className: string]: string | undefined } = {};

  traverse(json).forEach(function (item) {
    if (isNode(item)) {
      if (nodeHasCss(item)) {
        const value = parseCssObject(item.bindings.css?.code as string);
        delete item.bindings.css;

        const normalizedName = normalizeName(item.properties.$name);

        const componentName = normalizedName
          ? dashCase(normalizedName)
          : /^h\d$/.test(item.name || '')
          ? item.name
          : dashCase(normalizeName(item.name) || 'div');

        const classNameWPrefix = `${componentName}${options.prefix ? `-${options.prefix}` : ''}`;

        const stylesHash = hash(value);
        if (componentHashes[componentName] === stylesHash) {
          const className = classNameWPrefix;
          updateClassForNode(item, className);
          return;
        }

        if (!componentHashes[componentName]) {
          componentHashes[componentName] = stylesHash;
        }

        const index = (componentIndexes[componentName] =
          (componentIndexes[componentName] || 0) + 1);
        const className = `${classNameWPrefix}${index === 1 ? '' : `-${index}`}`;

        updateClassForNode(item, className);

        styleMap[className] = value;
      }
      delete item.bindings.css;
    }
  });

  return styleMap;
};

export const collectCss = (json: JsonComponent, options: CollectStyleOptions = {}): string => {
  const styles = collectStyles(json, options);
  let css = '';
  css += !!json.style?.length ? `${json.style}\n` : '';
  css += classStyleMapToCss(styles);
  return css;
};

const classStyleMapToCss = (map: ClassStyleMap): string => {
  let str = '';

  for (const key in map) {
    const styles = getStylesOnly(map[key]);
    str += `.${key} {\n${styleMapToCss(styles)}\n}`;

    const nestedSelectors = getNestedSelectors(map[key]);
    for (const nestedSelector in nestedSelectors) {
      const value = nestedSelectors[nestedSelector] as any;

      if (nestedSelector.startsWith('@')) {
        str += `${nestedSelector} { .${key} { ${styleMapToCss(value)} } }`;
      } else {
        const getSelector = (nestedSelector: string) => {
          if (nestedSelector.startsWith(':')) {
            return `.${key}${nestedSelector}`;
          }

          if (nestedSelector.includes('&')) {
            return nestedSelector.replace(/&/g, `.${key}`);
          }

          return `.${key} ${nestedSelector}`;
        };

        str += `${getSelector(nestedSelector)} {\n${styleMapToCss(value)}\n}`;
      }
    }
  }

  return str;
};
