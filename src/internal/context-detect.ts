import type {
  ContextGetInfo,
  ContextSetInfo,
  JsonComponent,
  ReactivityType,
} from '../types';

export const hasContext = (component: JsonComponent) =>
  hasSetContext(component) || hasGetContext(component);

export const hasSetContext = (component: JsonComponent) =>
  Object.keys(component.context.set).length > 0;

export const hasGetContext = (component: JsonComponent) =>
  Object.keys(component.context.get).length > 0;

export const getContextType = ({
  component,
  context,
}: {
  component: JsonComponent;
  context: ContextGetInfo | ContextSetInfo;
}): ReactivityType =>
  component.meta.useMetadata?.contextTypes?.[context.name] || context.type || 'normal';
