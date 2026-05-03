import { types } from '@babel/core';
import generate from '@babel/generator';
import { pipe } from 'fp-ts/lib/function';
import { babelTransformExpression } from './babel-transform';

/**
 * Type hack: augment the BaseNode interface with an internal tracking flag
 * for newly-generated AST nodes (used to prevent re-traversal of replacements).
 */
type AllowMeta<T = types.Node> = T & {
  _builder_meta?: {
    newlyGenerated: boolean;
  };
};

export type ReplaceTo =
  | string
  | ((accessedProperty: string, matchedIdentifier: string) => string)
  | null;

type ReplaceArgs = {
  code: string;
  from: string | string[];
  to: ReplaceTo;
};

export type NodeMap = {
  from: types.Node;
  condition?: (path: babel.NodePath<types.Node>) => boolean;
  to: types.Node;
};

const getToParam = (
  path: babel.NodePath<types.Identifier | types.MemberExpression | types.OptionalMemberExpression>,
): string => {
  if (types.isMemberExpression(path.node) || types.isOptionalMemberExpression(path.node)) {
    if (types.isIdentifier(path.node.property)) {
      const propertyName = path.node.property.name;
      return propertyName;
    } else {
      const x = generate(path.node.property).code;
      return x;
    }
  } else {
    const nodeName = path.node.name;
    return nodeName;
  }
};

const _replaceIdentifiers = (
  path: babel.NodePath<types.MemberExpression | types.OptionalMemberExpression | types.Identifier>,
  { from, to }: Pick<ReplaceArgs, 'from' | 'to'>,
) => {
  const memberExpressionObject = types.isIdentifier(path.node) ? path.node : path.node.object;
  const normalizedFrom = Array.isArray(from) ? from : [from];

  if (
    !types.isIdentifier(memberExpressionObject) ||
    (path.node as AllowMeta)?._builder_meta?.newlyGenerated
  ) {
    return;
  }

  const matchesFrom = normalizedFrom.includes(memberExpressionObject.name);

  if (matchesFrom) {
    if (to) {
      if (typeof to === 'string') {
        const cleanedIdentifier = pipe(
          to.endsWith('.') ? to.substring(0, to.length - 1) : to,
          types.identifier,
        );

        if (types.isIdentifier(path.node)) {
          path.replaceWith(cleanedIdentifier);
        } else {
          path.replaceWith(types.memberExpression(cleanedIdentifier, path.node.property));
        }
      } else {
        try {
          const newMemberExpression = pipe(
            getToParam(path),
            (x) => to(x, memberExpressionObject.name),
            (expression) => {
              const [head, ...tail] = expression.split('.');
              return [head, tail.join('.')];
            },
            ([obj, prop]) => {
              const objIdentifier = types.identifier(obj);
              if (prop === '') {
                return objIdentifier;
              } else {
                return types.memberExpression(objIdentifier, types.identifier(prop));
              }
            },
          );

          if (generate(path.node).code === generate(newMemberExpression).code) {
            return;
          }
          (newMemberExpression as AllowMeta)._builder_meta = { newlyGenerated: true };
          path.replaceWith(newMemberExpression);
        } catch (err) {
          console.debug('Could not replace node.');
        }
      }
    } else {
      if (!types.isIdentifier(path.node)) {
        path.replaceWith(path.node.property);
      }
    }
  }
};

/**
 * @deprecated Use `replaceNodes` instead.
 */
export const replaceIdentifiers = ({ code, from, to }: ReplaceArgs) => {
  try {
    return pipe(
      babelTransformExpression(code, {
        MemberExpression(path) {
          _replaceIdentifiers(path, { from, to });
        },
        OptionalMemberExpression(path) {
          _replaceIdentifiers(path, { from, to });
        },
        Identifier(path) {
          if (
            !types.isMemberExpression(path.parent) &&
            !types.isOptionalMemberExpression(path.parent) &&
            !types.isFunctionDeclaration(path.parent) &&
            !types.isObjectProperty(path.parent)
          ) {
            _replaceIdentifiers(path, { from, to });
          }
        },
      }),
      (code) => code.trim(),
    );
  } catch (err) {
    throw err;
  }
};

export const replaceStateIdentifier = (to: ReplaceArgs['to']) => (code: string) =>
  replaceIdentifiers({ code, from: 'state', to });

export const replacePropsIdentifier = (to: ReplaceArgs['to']) => (code: string) =>
  replaceIdentifiers({ code, from: 'props', to });

const isNewlyGenerated = (node: types.Node) => (node as AllowMeta)?._builder_meta?.newlyGenerated;

/**
 * Replaces all instances of a Babel AST Node with a new Node within a code string.
 */
export const replaceNodes = ({ code, nodeMaps }: { code: string; nodeMaps: NodeMap[] }) => {
  const searchAndReplace = (path: babel.NodePath<types.Node>) => {
    if (isNewlyGenerated(path.node) || isNewlyGenerated(path.parent)) return;

    for (const { from, to, condition } of nodeMaps) {
      if (isNewlyGenerated(path.node) || isNewlyGenerated(path.parent)) return;

      const matchesCondition = condition ? condition(path) : true;

      if (generate(path.node).code === generate(from).code && matchesCondition) {
        const x = types.cloneNode(to);
        (x as AllowMeta)._builder_meta = { newlyGenerated: true };
        try {
          path.replaceWith(x);
        } catch (err) {
          console.log('error replacing', {
            code,
            orig: generate(path.node).code,
            to: generate(x).code,
          });
        }
      }
    }
  };

  return babelTransformExpression(code, {
    ThisExpression(path) {
      searchAndReplace(path);
    },
    MemberExpression(path) {
      searchAndReplace(path);
    },
    Identifier(path) {
      searchAndReplace(path);
    },
    OptionalMemberExpression(path) {
      searchAndReplace(path);
    },
  });
};
