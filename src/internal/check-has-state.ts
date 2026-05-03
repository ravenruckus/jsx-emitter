import type { JsonComponent } from '../types';

export const checkHasState = (component: JsonComponent) =>
  Boolean(Object.keys(component.state).length);
