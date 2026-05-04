import json5 from 'json5';
import { camelCase, size } from 'lodash';
import traverse from 'neotraverse/legacy';
import type { Dictionary, JsonComponent, JsonNode, ToReactOptions } from '../types';
import { createSingleBinding } from './bindings';
import { isNode } from './is-node';
import { sanitizeReactNativeBlockStyles } from './sanitize-rn-block-styles';
import type { ClassStyleMap } from './styles/helpers';

const MEDIA_QUERY_KEY_REGEX = /^@media.*/;

const sanitizeStyle = (obj: any) => (key: string, _value: string) => {
  const propertyValue = obj[key];

  if (key.match(MEDIA_QUERY_KEY_REGEX)) {
    console.warn('Unsupported: skipping media queries for react-native: ', key, propertyValue);
    delete obj[key];
    return;
  }
};

export const collectReactNativeStyles = (
  json: JsonComponent,
  options: ToReactOptions,
): ClassStyleMap => {
  const styleMap: ClassStyleMap = {};

  const componentIndexes: Dictionary<number | undefined> = {};
  const getStyleSheetName = (item: JsonNode) => {
    const componentName = camelCase(item.name || 'view');
    // If we have already seen this component name, we will increment the index. Otherwise, we will set the index to 1.
    const index = (componentIndexes[componentName] = (componentIndexes[componentName] || 0) + 1);
    return `${componentName}${index}`;
  };
  traverse(json).forEach(function (item) {
    if (!isNode(item)) {
      return;
    }
    let cssValue = json5.parse(item.bindings.css?.code || '{}');
    delete item.bindings.css;

    if (size(cssValue)) {
      // Style properties like `"20px"` need to be numbers like `20` for react native
      for (const key in cssValue) {
        sanitizeStyle(cssValue)(key, cssValue[key]);
        cssValue = sanitizeReactNativeBlockStyles(cssValue, options);
      }
    }

    try {
      let styleValue = json5.parse(item.bindings.style?.code || '{}');
      if (size(styleValue)) {
        // Style properties like `"20px"` need to be numbers like `20` for react native
        for (const key in styleValue) {
          sanitizeStyle(styleValue)(key, styleValue[key]);
          styleValue = sanitizeReactNativeBlockStyles(styleValue, options);
        }

        item.bindings.style!.code = json5.stringify(styleValue);
      }
    } catch (e) {}

    if (!size(cssValue)) {
      return;
    }

    const styleSheetName = getStyleSheetName(item);
    const styleSheetAccess = `styles.${styleSheetName}`;
    styleMap[styleSheetName] = cssValue;

    if (!item.bindings.style) {
      item.bindings.style = createSingleBinding({
        code: styleSheetAccess,
      });
      return;
    }
    try {
      // run the code below only if the style binding is a JSON object
      json5.parse(item.bindings.style.code || '{}');

      item.bindings.style = createSingleBinding({
        code:
          item.bindings.style?.code.replace(/}$/, `, ...${styleSheetAccess} }`) || styleSheetAccess,
      });
    } catch (e) {
      // if not a JSON, then it's a property, so we should spread it.
      item.bindings.style = createSingleBinding({
        code: `{
        ...${styleSheetAccess},
        ...${item.bindings.style.code}
        }`,
      });
    }
  });

  return styleMap;
};
