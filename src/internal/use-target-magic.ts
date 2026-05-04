export const USE_TARGET_MAGIC_STRING = 'USE_TARGET_BLOCK_';

const idRegex = /\d*/;
const REGEX_BLOCK_NAME = 'blockId';

export const USE_TARGET_MAGIC_REGEX = new RegExp(
  `["']${USE_TARGET_MAGIC_STRING}\(?<${REGEX_BLOCK_NAME}>${idRegex.source}\)["']`,
  'g',
);

const USE_TARGET_MAGIC_REGEX_WITHOUT_G = new RegExp(
  `["']${USE_TARGET_MAGIC_STRING}\(?<${REGEX_BLOCK_NAME}>${idRegex.source}\)["']`,
);

export const getMagicString = (targetId: string) => [USE_TARGET_MAGIC_STRING, targetId].join('');

export const getIdFromMatch = (match: string) => {
  const result = match.match(USE_TARGET_MAGIC_REGEX_WITHOUT_G);
  if (!result) return undefined;
  return result.groups?.[REGEX_BLOCK_NAME];
};
