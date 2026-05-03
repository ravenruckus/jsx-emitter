import { types } from '@babel/core';
import { babelTransformExpression } from './babel-transform';

type StateSetterTransformer = ({
  path,
  propertyName,
}: {
  path: babel.NodePath<types.AssignmentExpression>;
  propertyName: string;
}) => types.CallExpression;

/**
 * Finds instances of state being set in `value`, and transforms them using the
 * provided `transformer`.
 */
export const transformStateSetters = ({
  value,
  transformer,
}: {
  value: string;
  transformer: StateSetterTransformer;
}) =>
  babelTransformExpression(value, {
    AssignmentExpression(path) {
      const { node } = path;
      if (
        types.isMemberExpression(node.left) &&
        types.isIdentifier(node.left.object) &&
        node.left.object.name === 'state'
      ) {
        const propertyName = (node.left.property as types.Identifier).name;
        const newExpression = transformer({ path, propertyName });
        path.replaceWith(newExpression);
      }
    },
  });
