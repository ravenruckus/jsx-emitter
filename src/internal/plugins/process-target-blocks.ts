import type { Plugin, TargetBlockDefinition } from '../../types';
import { createSingleBinding } from '../bindings';
import {
  getIdFromMatch,
  USE_TARGET_MAGIC_REGEX,
  USE_TARGET_MAGIC_STRING,
} from '../use-target-magic';
import { createCodeProcessorPlugin } from './process-code';

const TARGET = 'react' as const;

const getBlockForTarget = (targetBlock: TargetBlockDefinition) =>
  targetBlock[TARGET] || targetBlock['default'];

/**
 * Resolves `useTarget()` magic placeholders for the React target.
 */
export const processTargetBlocks = (): Plugin => {
  const plugin = createCodeProcessorPlugin(
    (codeType, json, node) => (code, key) => {
      if (codeType === 'properties') {
        const matches = code.includes(USE_TARGET_MAGIC_STRING);
        const property = node?.properties[key];
        if (!matches || !property) return code;

        node.bindings[key] = createSingleBinding({ code: `"${property}"` });

        return () => {
          delete node.properties[key];
        };
      }

      const matches = code.match(USE_TARGET_MAGIC_REGEX);

      if (!matches) return code;
      for (const m of matches) {
        const targetId = getIdFromMatch(m);

        if (!targetId) continue;

        const targetBlock = json.targetBlocks?.[targetId];

        if (!targetBlock) {
          throw new Error(`Could not find \`useTarget()\` value in "${json.name}".`);
        }

        const block = getBlockForTarget(targetBlock);

        if (!block) {
          if (targetBlock.settings.requiresDefault) {
            throw new Error(
              `Could not find \`useTarget()\` value in "${json.name}" for target "${TARGET}", and no default value was set.`,
            );
          } else {
            code = code.replaceAll(m, '');
            continue;
          }
        }

        code = code.replaceAll(m, block.code);
      }

      return code;
    },
    { processProperties: true },
  );

  return () => ({ json: { pre: plugin } });
};
